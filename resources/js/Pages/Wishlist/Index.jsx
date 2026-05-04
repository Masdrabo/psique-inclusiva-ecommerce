import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";
import ProductCard from "@/Components/Shop/ProductCard";

function SectionBlock({ title, subtitle, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="p-6 sm:p-8">
        <div className="mb-6">
          <div className="text-2xl font-bold text-gray-900">{title}</div>
          {subtitle ? (
            <div className="mt-2 text-base text-gray-600">{subtitle}</div>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  );
}

export default function WishlistIndex() {
  const {
    auth,
    locale,
    items,
    recentPurchasedProducts = [],
    recentProducts = [],
  } = usePage().props;

  const user = auth?.user ?? null;
  const { t } = useI18n();

  const wishlistItems = Array.isArray(items) ? items : [];
  const purchasedItems = Array.isArray(recentPurchasedProducts)
    ? recentPurchasedProducts
    : [];
  const latestItems = Array.isArray(recentProducts) ? recentProducts : [];

  const hasSuggestions = purchasedItems.length > 0 || latestItems.length > 0;

  function addToCart(product) {
    if (!user) {
      router.visit(route("login", { locale }));
      return;
    }

    router.post(
      route("cart.items.store", { locale }),
      {
        product_id: product.id,
        qty: 1,
      },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => {
          router.reload({ only: ["cart"] });
        },
      }
    );
  }

  return (
    <AuthenticatedLayout
      header={
        <div>
          <h2 className="text-xl font-semibold leading-tight text-gray-800">
            {t("ui.wishlist.heading", "My favourites")}
          </h2>
          <div className="mt-1 text-sm text-gray-600">
            {t("ui.wishlist.subtitle", "Products saved for later")}
          </div>
        </div>
      }
    >
      <Head title={t("ui.wishlist.title", "Favourites")} />

      <div className="py-6">
        <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
          <SectionBlock
            title={t("ui.wishlist.title", "Favourites")}
            subtitle={t("ui.wishlist.subtitle", "Products saved for later")}
          >
            {wishlistItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {t(
                    "ui.wishlist.empty_title",
                    "Your favourites list is empty"
                  )}
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  {t(
                    "ui.wishlist.empty_text",
                    "Save products to find them quickly later."
                  )}
                </div>

                <div className="mt-5">
                  <Link
                    href={route("shop.index", { locale })}
                    className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    {t("ui.wishlist.go_to_shop", "Go to shop")}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {wishlistItems.map((item) => (
                  <ProductCard
                    key={item.id}
                    product={item.product}
                    locale={locale}
                    user={user}
                    isSaved
                    t={t}
                    showWishlistButton={!!user}
                    showAddToCartButton
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}
          </SectionBlock>

          {hasSuggestions ? (
            purchasedItems.length > 0 ? (
              <SectionBlock
                title={t(
                  "ui.wishlist.recent_purchases_title",
                  "Recently purchased"
                )}
                subtitle={t(
                  "ui.wishlist.recent_purchases_subtitle",
                  "Products you bought recently and may want again."
                )}
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {purchasedItems.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      locale={locale}
                      user={user}
                      isSaved={!!product.is_in_wishlist}
                      t={t}
                      showWishlistButton={!!user}
                      showAddToCartButton
                      onAddToCart={addToCart}
                    />
                  ))}
                </div>
              </SectionBlock>
            ) : (
              <SectionBlock
                title={t("ui.wishlist.latest_products_title", "Latest products")}
                subtitle={t(
                  "ui.wishlist.latest_products_subtitle",
                  "Discover the newest products added to the shop."
                )}
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {latestItems.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      locale={locale}
                      user={user}
                      isSaved={!!product.is_in_wishlist}
                      t={t}
                      showWishlistButton={!!user}
                      showAddToCartButton
                      onAddToCart={addToCart}
                    />
                  ))}
                </div>
              </SectionBlock>
            )
          ) : null}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
