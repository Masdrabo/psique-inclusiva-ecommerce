<?php

namespace Tests\Feature;

use App\Mail\ReturnRequestedAdminMail;
use App\Mail\ReturnRequestedMail;
use App\Mail\ReturnStatusUpdatedMail;
use App\Models\Currency;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturn;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Models\ReturnItem;
use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OrderReturnFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'returns.window_days' => 14,
            'mail.order_notification_to' => 'admin@test.local',
            'mail.order_notification_locale' => 'pt',
            'app.supported_locales' => ['pt', 'en'],
            'app.fallback_locale' => 'pt',
        ]);
    }

    public function test_customer_can_create_return_within_window_and_queues_emails(): void
    {
        Mail::fake();

        [$admin, $order, $orderItemA, $orderItemB, $productA, $productB, $customerUser] = $this->makeOrderFixture();

        $response = $this->actingAs($customerUser)
            ->from('/pt/panel/orders/' . $order->id)
            ->post(route('panel.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Quero devolver parte da encomenda',
                'notes' => 'Pedido feito pelo cliente',
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'qty' => 1,
                        'reason' => 'Tamanho errado',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $return = OrderReturn::query()->first();

        $this->assertNotNull($return);
        $this->assertSame((int) $order->id, (int) $return->order_id);
        $this->assertSame('requested', $return->status);
        $this->assertSame((int) $customerUser->id, (int) $return->requested_by_user_id);
        $this->assertNotNull($return->requested_at);

        $this->assertDatabaseHas('return_items', [
            'return_id' => $return->id,
            'order_item_id' => $orderItemA->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Tamanho errado',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        Mail::assertQueued(ReturnRequestedAdminMail::class, function (ReturnRequestedAdminMail $mail) use ($return) {
            return (int) $mail->orderReturn->id === (int) $return->id;
        });

        // No teu projeto este mail pode não estar sempre queued da mesma forma.
        // Testamos de forma tolerante: se existir, tem de ser para este return.
        $queuedCustomerMails = Mail::queued(ReturnRequestedMail::class);

        if ($queuedCustomerMails->count() > 0) {
            Mail::assertQueued(ReturnRequestedMail::class, function (ReturnRequestedMail $mail) use ($return) {
                return (int) $mail->orderReturn->id === (int) $return->id;
            });
        }
    }

    public function test_customer_cannot_create_return_after_return_window_expires(): void
    {
        Mail::fake();

        [$admin, $order, $orderItemA, $orderItemB, $productA, $productB, $customerUser] =
            $this->makeOrderFixture(deliveredAt: now()->subDays(15));

        $response = $this->actingAs($customerUser)
            ->from('/pt/panel/orders/' . $order->id)
            ->post(route('panel.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Pedido fora do prazo',
                'notes' => null,
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'qty' => 1,
                        'reason' => 'Já passou o prazo',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('return');

        $this->assertDatabaseCount('returns', 0);
        $this->assertDatabaseCount('return_items', 0);

        Mail::assertNothingQueued();
    }

    public function test_customer_cannot_create_return_before_order_is_delivered(): void
    {
        Mail::fake();

        [$admin, $order, $orderItemA, $orderItemB, $productA, $productB, $customerUser] =
            $this->makeOrderFixture(
                deliveredAt: null,
                statusCode: 'shipped',
                statusName: 'Enviada',
                shipmentStatus: 'shipped'
            );

        $response = $this->actingAs($customerUser)
            ->from('/pt/panel/orders/' . $order->id)
            ->post(route('panel.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Ainda não entregue',
                'notes' => null,
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'qty' => 1,
                        'reason' => 'Teste',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('return');

        $this->assertDatabaseCount('returns', 0);
        $this->assertDatabaseCount('return_items', 0);

        Mail::assertNothingQueued();
    }

    public function test_admin_can_create_partial_return(): void
    {
        [$admin, $order, $orderItemA, $orderItemB, $productA] = $this->makeOrderFixture();

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Cliente quer devolver parte da encomenda',
                'notes' => 'Pedido inicial de devolução',
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'qty' => 1,
                        'reason' => 'Tamanho errado',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ])
            ->assertRedirect();

        $return = OrderReturn::query()->first();

        $this->assertNotNull($return);
        $this->assertSame((int) $order->id, (int) $return->order_id);
        $this->assertSame('requested', $return->status);
        $this->assertSame('Cliente quer devolver parte da encomenda', $return->reason);
        $this->assertSame('Pedido inicial de devolução', $return->notes);
        $this->assertNotNull($return->requested_at);

        $this->assertDatabaseHas('return_items', [
            'return_id' => $return->id,
            'order_item_id' => $orderItemA->id,
            'qty' => 1,
            'received_qty' => 0,
            'restock_qty' => 0,
            'reason' => 'Tamanho errado',
            'condition' => 'opened',
            'resolution' => 'refund',
        ]);

        $inventory = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->first();

        $this->assertNotNull($inventory);
        $this->assertSame(10, (int) $inventory->qty_on_hand);
    }

    public function test_admin_can_approve_receive_and_close_non_refund_return_with_inventory_restock_and_status_mails(): void
    {
        Mail::fake();

        [$admin, $order, $orderItemA, $orderItemB, $productA, $productB, $customerUser] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Cliente devolve 1 unidade',
            'notes' => 'Criado em backoffice',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Não serviu',
                    'condition' => 'opened',
                    'resolution' => 'inspection',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.approve', [
                'locale' => 'pt',
                'order' => $order->id,
                'return' => $return->id,
            ]), [
                'notes' => 'Aprovado pela equipa',
            ])
            ->assertRedirect();

        $return->refresh();
        $this->assertSame('approved', $return->status);
        $this->assertNotNull($return->approved_at);
        $this->assertSame((int) $admin->id, (int) $return->approved_by_user_id);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.receive', [
                'locale' => 'pt',
                'order' => $order->id,
                'return' => $return->id,
            ]), [
                'notes' => 'Recebido no armazém',
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'received_qty' => 1,
                        'restock_qty' => 1,
                    ],
                ],
            ])
            ->assertRedirect();

        $return->refresh();
        $returnItem = ReturnItem::query()->where('return_id', $return->id)->firstOrFail();
        $inventory = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame('received', $return->status);
        $this->assertNotNull($return->received_at);
        $this->assertSame((int) $admin->id, (int) $return->received_by_user_id);
        $this->assertSame(1, (int) $returnItem->received_qty);
        $this->assertSame(1, (int) $returnItem->restock_qty);
        $this->assertSame(11, (int) $inventory->qty_on_hand);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.close', [
                'locale' => 'pt',
                'order' => $order->id,
                'return' => $return->id,
            ]), [
                'notes' => 'Processo encerrado',
            ])
            ->assertRedirect();

        $return->refresh();
        $this->assertSame('closed', $return->status);
        $this->assertNotNull($return->closed_at);

        Mail::assertQueued(ReturnStatusUpdatedMail::class, function (ReturnStatusUpdatedMail $mail) use ($return) {
            return (int) $mail->orderReturn->id === (int) $return->id;
        });

        $this->assertGreaterThanOrEqual(
            3,
            Mail::queued(ReturnStatusUpdatedMail::class)->count()
        );
    }

    public function test_admin_can_reject_return_and_queues_status_mail(): void
    {
        Mail::fake();

        [$admin, $order, $orderItemA, $orderItemB, $productA, $productB, $customerUser] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Tentativa de devolução',
            'notes' => 'Vai ser rejeitada',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Sem motivo válido',
                    'condition' => 'used',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.reject', [
                'locale' => 'pt',
                'order' => $order->id,
                'return' => $return->id,
            ]), [
                'notes' => 'Rejeitado pela equipa',
            ])
            ->assertRedirect();

        $return->refresh();

        $this->assertSame('rejected', $return->status);
        $this->assertNotNull($return->approved_at);
        $this->assertSame((int) $admin->id, (int) $return->approved_by_user_id);

        Mail::assertQueued(ReturnStatusUpdatedMail::class, function (ReturnStatusUpdatedMail $mail) use ($return) {
            return (int) $mail->orderReturn->id === (int) $return->id;
        });

        $this->assertGreaterThanOrEqual(
            1,
            Mail::queued(ReturnStatusUpdatedMail::class)->count()
        );
    }

    public function test_admin_cannot_return_more_than_remaining_returnable_qty(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Primeira devolução',
            'notes' => null,
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 2,
                    'reason' => 'Primeiro pedido',
                    'condition' => 'opened',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->post(route('admin.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Segunda devolução inválida',
                'notes' => null,
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'qty' => 1,
                        'reason' => 'Excede o restante',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ]);

        $response->assertRedirect();

        $this->assertSame(1, OrderReturn::query()->count());
        $this->assertSame(1, ReturnItem::query()->count());
    }

    public function test_return_receive_can_restock_only_part_of_received_qty(): void
    {
        [$admin, $order, $orderItemA, $orderItemB, $productA] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Devolução com parte não restockável',
            'notes' => null,
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 2,
                    'reason' => 'Uma caixa danificada',
                    'condition' => 'mixed',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.returns.approve', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [])->assertRedirect();

        $this->actingAs($admin)->post(route('admin.orders.returns.receive', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'received_qty' => 2,
                    'restock_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $returnItem = ReturnItem::query()->where('return_id', $return->id)->firstOrFail();
        $inventory = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(2, (int) $returnItem->received_qty);
        $this->assertSame(1, (int) $returnItem->restock_qty);
        $this->assertSame(11, (int) $inventory->qty_on_hand);
    }

    public function test_admin_can_register_exchange_shipment(): void
    {
        [$admin, $order, $orderItemA, $orderItemB, $productA, $productB] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Troca do produto',
            'notes' => 'Processo de troca',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Defeito',
                    'condition' => 'opened',
                    'resolution' => 'exchange',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.returns.approve', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [])->assertRedirect();

        $this->actingAs($admin)->post(route('admin.orders.returns.receive', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'received_qty' => 1,
                    'restock_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $this->actingAs($admin)->post(route('admin.orders.returns.exchange_ship', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'tracking_number' => 'TRACK-EX-001',
            'notes' => 'Enviado artigo de substituição',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'shipped_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $returnItem = ReturnItem::query()->where('return_id', $return->id)->firstOrFail();

        $this->assertSame(1, (int) $returnItem->exchange_shipped_qty);
        $this->assertSame('TRACK-EX-001', $returnItem->exchange_tracking_number);
        $this->assertNotNull($returnItem->exchange_shipped_at);
        $this->assertStringContainsString('Enviado artigo de substituição', (string) $returnItem->exchange_notes);
    }

    public function test_return_flow_does_not_create_refund_automatically(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Só return',
            'notes' => null,
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Apenas devolução',
                    'condition' => 'opened',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $this->assertDatabaseCount('refunds', 0);
        $this->assertDatabaseCount('refund_items', 0);
    }

    public function test_customer_cannot_access_admin_return_routes(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $customerUser = User::factory()->create([
            'role' => 'customer',
        ]);

        $this->actingAs($customerUser)
            ->post(route('admin.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Tentativa indevida',
                'notes' => null,
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'qty' => 1,
                        'reason' => 'Teste',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ])
            ->assertRedirect(route('fallback.page', [
            'locale' => 'pt',
        ]));

        $this->assertDatabaseCount('returns', 0);
    }

    public function test_customer_return_request_explicitly_queues_customer_email_with_correct_locale(): void
    {
        Mail::fake();

        [$admin, $order, $orderItemA, $orderItemB, $productA, $productB, $customerUser] = $this->makeOrderFixture();

        $response = $this->actingAs($customerUser)
            ->from('/pt/panel/orders/' . $order->id)
            ->post(route('panel.orders.returns.store', [
                'locale' => 'pt',
                'order' => $order->id,
            ]), [
                'reason' => 'Pedido com verificação de email',
                'notes' => 'Teste dedicado ao email do cliente',
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'qty' => 1,
                        'reason' => 'Quero devolver este artigo',
                        'condition' => 'opened',
                        'resolution' => 'refund',
                    ],
                ],
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $orderReturn = OrderReturn::query()->latest('id')->first();

        $this->assertNotNull($orderReturn);
        $this->assertSame((int) $order->id, (int) $orderReturn->order_id);
        $this->assertSame((int) $customerUser->id, (int) $orderReturn->requested_by_user_id);

        Mail::assertQueued(ReturnRequestedMail::class, function (ReturnRequestedMail $mail) use ($orderReturn) {
            return (int) $mail->orderReturn->id === (int) $orderReturn->id
                && $mail->localeCode === 'pt';
        });

        Mail::assertQueued(ReturnRequestedAdminMail::class, function (ReturnRequestedAdminMail $mail) use ($orderReturn) {
            return (int) $mail->orderReturn->id === (int) $orderReturn->id;
        });

        $this->assertSame(1, Mail::queued(ReturnRequestedMail::class)->count());
        $this->assertSame(1, Mail::queued(ReturnRequestedAdminMail::class)->count());
    }

    public function test_admin_can_create_manual_refund_after_return_is_received(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Devolução para refund',
            'notes' => 'Criado em backoffice',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Não pretende o artigo',
                    'condition' => 'opened',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.returns.approve', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'notes' => 'Aprovado',
        ])->assertRedirect();

        $this->actingAs($admin)->post(route('admin.orders.returns.receive', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'notes' => 'Recebido no armazém',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'received_qty' => 1,
                    'restock_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $response = $this->actingAs($admin)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Refund da devolução recebida',
            'notes' => 'Refund manual após receção',
            'idempotency_key' => '11111111-1111-4111-8111-111111111111',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                ],
            ],
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $refund = Refund::query()->first();
        $refundItem = RefundItem::query()->first();

        $this->assertNotNull($refund);
        $this->assertNotNull($refundItem);

        $this->assertSame((int) $order->id, (int) $refund->order_id);
        $this->assertSame(1000, (int) $refund->amount);
        $this->assertSame('Refund da devolução recebida', $refund->reason);
        $this->assertSame('Refund manual após receção', $refund->notes);

        $this->assertSame((int) $refund->id, (int) $refundItem->refund_id);
        $this->assertSame((int) $orderItemA->id, (int) $refundItem->order_item_id);
        $this->assertSame(1, (int) $refundItem->qty);
        $this->assertSame(1000, (int) $refundItem->amount);

        $orderItemA->refresh();
        $this->assertSame(1, (int) $orderItemA->refundItems()->sum('qty'));
    }

    public function test_admin_cannot_close_received_return_with_pending_refund_until_refund_is_created(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Devolução com refund pendente',
            'notes' => null,
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Cliente quer refund',
                    'condition' => 'opened',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.returns.approve', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [])->assertRedirect();

        $this->actingAs($admin)->post(route('admin.orders.returns.receive', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'received_qty' => 1,
                    'restock_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $responseBeforeRefund = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->post(route('admin.orders.returns.close', [
                'locale' => 'pt',
                'order' => $order->id,
                'return' => $return->id,
            ]), [
                'notes' => 'Tentativa de fechar antes do refund',
            ]);

        $responseBeforeRefund->assertRedirect();
        $responseBeforeRefund->assertSessionHasErrors('return');

        $return->refresh();
        $this->assertSame('received', $return->status);
        $this->assertNull($return->closed_at);

        $this->assertDatabaseCount('refunds', 0);
        $this->assertDatabaseCount('refund_items', 0);

        $this->actingAs($admin)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Refund pendente tratado',
            'notes' => 'Refund criado antes de fechar',
            'idempotency_key' => '22222222-2222-4222-8222-222222222222',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $responseAfterRefund = $this->actingAs($admin)->post(route('admin.orders.returns.close', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'notes' => 'Agora já pode fechar',
        ]);

        $responseAfterRefund->assertRedirect();
        $responseAfterRefund->assertSessionHasNoErrors();

        $return->refresh();
        $this->assertSame('closed', $return->status);
        $this->assertNotNull($return->closed_at);
    }

    public function test_manual_refund_does_not_increase_inventory_stock(): void
    {
        [$admin, $order, $orderItemA, $orderItemB, $productA] = $this->makeOrderFixture();

        $inventoryBefore = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(10, (int) $inventoryBefore->qty_on_hand);

        $response = $this->actingAs($admin)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Refund manual sem devolução física',
            'notes' => 'Teste de stock',
            'idempotency_key' => '33333333-3333-4333-8333-333333333333',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                ],
            ],
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $refund = Refund::query()->first();
        $refundItem = RefundItem::query()->first();

        $this->assertNotNull($refund);
        $this->assertNotNull($refundItem);
        $this->assertSame(1000, (int) $refund->amount);
        $this->assertSame(1, (int) $refundItem->qty);
        $this->assertSame(1000, (int) $refundItem->amount);

        $inventoryAfter = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(10, (int) $inventoryAfter->qty_on_hand);
    }

    public function test_receive_return_with_restock_increases_inventory_only_on_receive(): void
    {
        [$admin, $order, $orderItemA, $orderItemB, $productA] = $this->makeOrderFixture();

        $inventoryBefore = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(10, (int) $inventoryBefore->qty_on_hand);

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Devolução com restock',
            'notes' => null,
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Artigo devolvido',
                    'condition' => 'opened',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.returns.approve', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [])->assertRedirect();

        $inventoryAfterApprove = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(10, (int) $inventoryAfterApprove->qty_on_hand);

        $this->actingAs($admin)->post(route('admin.orders.returns.receive', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'received_qty' => 1,
                    'restock_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $inventoryAfterReceive = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(11, (int) $inventoryAfterReceive->qty_on_hand);
    }

    public function test_refund_after_received_return_does_not_duplicate_inventory_restock(): void
    {
        [$admin, $order, $orderItemA, $orderItemB, $productA] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Devolução para refund sem duplicar stock',
            'notes' => null,
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Cliente devolveu',
                    'condition' => 'opened',
                    'resolution' => 'refund',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.returns.approve', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [])->assertRedirect();

        $this->actingAs($admin)->post(route('admin.orders.returns.receive', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'received_qty' => 1,
                    'restock_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $inventoryAfterReceive = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(11, (int) $inventoryAfterReceive->qty_on_hand);

        $this->actingAs($admin)->post(route('admin.orders.refunds.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Refund após devolução recebida',
            'notes' => 'Não deve duplicar restock',
            'idempotency_key' => '44444444-4444-4444-8444-444444444444',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $refund = Refund::query()->first();
        $this->assertNotNull($refund);
        $this->assertSame(1000, (int) $refund->amount);

        $inventoryAfterRefund = Inventory::query()
            ->where('product_id', $productA->id)
            ->whereNull('variant_id')
            ->firstOrFail();

        $this->assertSame(11, (int) $inventoryAfterRefund->qty_on_hand);
    }

    public function test_admin_cannot_ship_exchange_more_than_received_qty(): void
    {
        [$admin, $order, $orderItemA] = $this->makeOrderFixture();

        $this->actingAs($admin)->post(route('admin.orders.returns.store', [
            'locale' => 'pt',
            'order' => $order->id,
        ]), [
            'reason' => 'Troca do produto',
            'notes' => 'Teste guardrail exchange',
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'qty' => 1,
                    'reason' => 'Produto com defeito',
                    'condition' => 'opened',
                    'resolution' => 'exchange',
                ],
            ],
        ])->assertRedirect();

        $return = OrderReturn::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.orders.returns.approve', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [])->assertRedirect();

        $this->actingAs($admin)->post(route('admin.orders.returns.receive', [
            'locale' => 'pt',
            'order' => $order->id,
            'return' => $return->id,
        ]), [
            'items' => [
                [
                    'order_item_id' => $orderItemA->id,
                    'received_qty' => 1,
                    'restock_qty' => 1,
                ],
            ],
        ])->assertRedirect();

        $response = $this->actingAs($admin)
            ->from(route('admin.orders.show', [
                'locale' => 'pt',
                'order' => $order->id,
            ]))
            ->post(route('admin.orders.returns.exchange_ship', [
                'locale' => 'pt',
                'order' => $order->id,
                'return' => $return->id,
            ]), [
                'tracking_number' => 'TRACK-EX-OVER',
                'notes' => 'Tentativa inválida',
                'items' => [
                    [
                        'order_item_id' => $orderItemA->id,
                        'shipped_qty' => 2,
                    ],
                ],
            ]);

        $response->assertRedirect();

        $returnItem = ReturnItem::query()->where('return_id', $return->id)->firstOrFail();

        $this->assertSame(0, (int) $returnItem->exchange_shipped_qty);
        $this->assertNull($returnItem->exchange_tracking_number);
        $this->assertNull($returnItem->exchange_shipped_at);
    }

    private function makeOrderFixture(
        ?\DateTimeInterface $deliveredAt = null,
        string $statusCode = 'delivered',
        string $statusName = 'Entregue',
        string $shipmentStatus = 'delivered'
    ): array {
        $this->seedLanguages();
        $currency = $this->seedCurrency();
        $warehouse = $this->seedWarehouse();
        $status = $this->seedOrderStatus($statusCode, $statusName);

        $paymentMethod = PaymentMethod::query()->create([
            'code' => 'mbway',
            'name' => 'MB WAY',
            'is_active' => true,
        ]);

        $shippingMethod = ShippingMethod::query()->create([
            'code' => 'ctt',
            'name' => 'CTT',
            'is_active' => true,
        ]);

        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $customerUser = User::factory()->create([
            'role' => 'customer',
        ]);

        $customer = Customer::query()->create([
            'user_id' => $customerUser->id,
        ]);

        $productA = Product::query()->create([
            'sku' => 'PROD-A',
            'slug' => 'produto-a',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => true,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        $productB = Product::query()->create([
            'sku' => 'PROD-B',
            'slug' => 'produto-b',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'requires_shipping' => true,
            'manages_inventory' => false,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
        ]);

        $pt = Language::query()->where('code', 'pt')->firstOrFail();
        $en = Language::query()->where('code', 'en')->firstOrFail();

        foreach ([$pt, $en] as $language) {
            ProductTranslation::query()->create([
                'product_id' => $productA->id,
                'language_id' => $language->id,
                'name' => 'Produto A',
                'description' => 'Produto A',
                'meta_title' => 'Produto A',
                'meta_description' => 'Produto A',
                'is_machine_translated' => false,
            ]);

            ProductTranslation::query()->create([
                'product_id' => $productB->id,
                'language_id' => $language->id,
                'name' => 'Produto B',
                'description' => 'Produto B',
                'meta_title' => 'Produto B',
                'meta_description' => 'Produto B',
                'is_machine_translated' => false,
            ]);
        }

        Inventory::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'qty_on_hand' => 10,
            'qty_reserved' => 0,
        ]);

        $order = Order::query()->create([
            'order_number' => 'ORD-RET-0001',
            'user_id' => $customerUser->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua A',
                'city' => 'Porto',
                'postal_code' => '4000-001',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => 'Cliente Teste',
                'line1' => 'Rua A',
                'city' => 'Porto',
                'postal_code' => '4000-001',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 8000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 8000,
            'paid_at' => now(),
        ]);

        $orderItemA = OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productA->id,
            'variant_id' => null,
            'name' => 'Produto A',
            'sku' => 'PROD-A',
            'qty' => 2,
            'unit_amount' => 1000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2000,
            'meta' => [
                'business_type' => 'physical',
            ],
        ]);

        $orderItemB = OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $productB->id,
            'variant_id' => null,
            'name' => 'Produto B',
            'sku' => 'PROD-B',
            'qty' => 2,
            'unit_amount' => 3000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 6000,
            'meta' => [
                'business_type' => 'physical',
            ],
        ]);

        Payment::query()->create([
            'order_id' => $order->id,
            'payment_method_id' => $paymentMethod->id,
            'amount' => 8000,
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        Shipment::query()->create([
            'order_id' => $order->id,
            'shipping_method_id' => $shippingMethod->id,
            'status' => $shipmentStatus,
            'shipped_at' => now()->subDay(),
            'delivered_at' => $deliveredAt ?? now(),
        ]);

        return [$admin, $order, $orderItemA, $orderItemB, $productA, $productB, $customerUser];
    }

    private function seedLanguages(): void
    {
        Language::query()->firstOrCreate(
            ['code' => 'pt'],
            [
                'name' => 'Português',
                'is_default' => true,
                'is_active' => true,
            ]
        );

        Language::query()->firstOrCreate(
            ['code' => 'en'],
            [
                'name' => 'English',
                'is_default' => false,
                'is_active' => true,
            ]
        );
    }

    private function seedCurrency(): Currency
    {
        return Currency::query()->firstOrCreate(
            ['code' => 'EUR'],
            [
                'name' => 'Euro',
                'symbol' => '€',
                'decimal_places' => 2,
                'is_active' => true,
                'is_default' => true,
            ]
        );
    }

    private function seedWarehouse(): Warehouse
    {
        return Warehouse::query()->firstOrCreate(
            ['name' => 'Main Warehouse'],
            [
                'is_default' => true,
            ]
        );
    }

    private function seedOrderStatus(string $code, string $name): OrderStatus
    {
        return OrderStatus::query()->firstOrCreate(
            ['code' => $code],
            ['name' => $name]
        );
    }
}
