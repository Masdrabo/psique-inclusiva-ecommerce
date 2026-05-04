import { Link, router } from "@inertiajs/react";

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || !currency) return null;

  const dp = Number.isFinite(currency.decimal_places)
    ? currency.decimal_places
    : 2;

  const value = (Number(amount) / Math.pow(10, dp)).toFixed(dp);

  return `${value} ${currency.symbol ?? currency.code ?? ""}`.trim();
}

function formatProductPrice(product, t) {
  const price = product?.price;

  if (!price || !price.currency) {
    return t("ui.shop.price_unavailable", "Price unavailable");
  }

  const minAmount =
    price.min_amount !== null && price.min_amount !== undefined
      ? price.min_amount
      : price.amount;

  const maxAmount =
    price.max_amount !== null && price.max_amount !== undefined
      ? price.max_amount
      : price.amount;

  const minLabel = formatMoney(minAmount, price.currency);
  const maxLabel = formatMoney(maxAmount, price.currency);

  if (!minLabel) {
    return t("ui.shop.price_unavailable", "Price unavailable");
  }

  if (price.is_range && minLabel && maxLabel && minAmount !== maxAmount) {
    return `${t("ui.shop.from", "From")} ${minLabel}`;
  }

  return minLabel;
}

function WishlistButton({
  locale,
  productId,
  isSaved,
  labelAdd,
  labelRemove,
  onToggle = null,
}) {
  const toggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (typeof onToggle === "function") {
      onToggle();
      return;
    }

    router.post(
      route("wishlist.toggle", { locale, product: productId }),
      {},
      {
        preserveScroll: true,
        preserveState: true,
      }
    );
  };

  return (
    <button
      type="button"
      onClick={toggleWishlist}
      className={[
        "absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 shadow-sm backdrop-blur transition",
        isSaved
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-gray-200 text-gray-600 hover:bg-gray-50",
      ].join(" ")}
      title={isSaved ? labelRemove : labelAdd}
      aria-label={isSaved ? labelRemove : labelAdd}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a1 1 0 0 1-.707-.293l-6.5-6.5a4.5 4.5 0 1 1 6.364-6.364L12 8.686l.843-.843a4.5 4.5 0 1 1 6.364 6.364l-6.5 6.5A1 1 0 0 1 12 21Z"
        />
      </svg>
    </button>
  );
}

function BestSellerBadge({ t }) {
  return (
    <div className="absolute left-3 top-3 z-20 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
      {t("ui.shop.best_seller_badge", "Best seller")}
    </div>
  );
}

export default function ProductCard({
  product,
  locale,
  user = null,
  t = (key, fallback) => fallback ?? key,
  isSaved = false,
  showWishlistButton = true,
  showAddToCartButton = true,
  showBestSellerBadge = false,
  onAddToCart = null,
  onToggleWishlist = null,
}) {
  if (!product) return null;

  const managesInventory = !!product.manages_inventory;
  const hasKnownStock =
    product.available_stock !== null && product.available_stock !== undefined;
  const availableStock = hasKnownStock ? Number(product.available_stock) : null;
  const isVariable = product.type === "variable" || !!product.has_variants;

  const isOutOfStock =
    managesInventory &&
    hasKnownStock &&
    Number.isFinite(availableStock) &&
    availableStock <= 0;

  const hasPrice = !!product.price;
  const canAddDirectly = !isVariable && hasPrice && !isOutOfStock;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (typeof onAddToCart === "function") {
      onAddToCart(product);
      return;
    }

    if (isVariable) {
      router.visit(
        route("shop.products.show", {
          locale,
          product: product.slug,
        })
      );
      return;
    }

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
      }
    );
  };

  const handleToggleWishlist = () => {
    if (typeof onToggleWishlist === "function") {
      onToggleWishlist(product);
      return;
    }

    if (!user) {
      router.visit(route("login", { locale }));
      return;
    }

    router.post(
      route("wishlist.toggle", { locale, product: product.id }),
      {},
      {
        preserveScroll: true,
        preserveState: true,
      }
    );
  };

  const priceLabel = formatProductPrice(product, t);

  return (
    <Link
      href={route("shop.products.show", {
        locale,
        product: product.slug,
      })}
      className="group relative block h-full overflow-hidden rounded-2xl border bg-white transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400"
    >
      {showBestSellerBadge ? <BestSellerBadge t={t} /> : null}

      {showWishlistButton ? (
        <WishlistButton
          locale={locale}
          productId={product.id}
          isSaved={!!isSaved}
          labelAdd={t("ui.wishlist.toggle_add", "Save")}
          labelRemove={t("ui.wishlist.toggle_remove", "Remove from wishlist")}
          onToggle={handleToggleWishlist}
        />
      ) : null}

      <div className="flex aspect-video items-center justify-center bg-gray-50">
        {product.image?.url ? (
          <img
            src={product.image.url}
            alt={product.image.alt ?? product.name ?? ""}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="text-base text-gray-500">
            {t("ui.shop.no_image", "No image")}
          </div>
        )}
      </div>

      <div className="flex min-h-[220px] flex-col space-y-3 p-5">
        <div className="text-base font-bold text-gray-900 group-hover:underline sm:text-lg">
          {product.name}
        </div>

        <div className="text-sm text-gray-500">
          {t("ui.shop.sku_label", "SKU")}: {product.sku}
        </div>

        <div className="text-lg font-semibold text-gray-900">{priceLabel}</div>

        <div className="mt-auto pt-2">
          {showAddToCartButton ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isVariable && !canAddDirectly}
              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVariable
                ? t("ui.shop.view_options", "View options")
                : isOutOfStock
                ? t("ui.shop.out_of_stock", "Out of stock")
                : t("ui.shop.add_to_cart", "Add to cart")}
            </button>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
