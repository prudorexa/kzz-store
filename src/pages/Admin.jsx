import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminDashboard from "../components/AdminDashboard.jsx";
import { useProducts } from "../hooks/useProducts.js";
import { saveCatalog } from "../lib/catalog.js";
import { formatKSh } from "../lib/format.js";
import { getSafeTrackingUrl, ORDER_FULFILLMENT_STATUSES } from "../lib/orderStatus.js";
import {
  isSupabaseConfigured,
  notifyProductsUpdated,
  supabase,
} from "../lib/supabase.js";

const categories = ["Boys", "Girls", "Baby"];

function createDraft(product) {
  return product
    ? {
        ...product,
        sizes: product.sizes.join(", "),
        colors: (product.colors || []).join(", "),
        cost: product.cost == null ? "" : String(product.cost),
        imagePath: product.image_path ?? null,
        imageIsLocal: false,
        removeImage: false,
        description: product.description || "",
        careInstructions: product.careInstructions || "",
        sizeGuide: product.sizeGuide || "",
        gallery: product.gallery || [],
        galleryPaths: product.galleryPaths || [],
        galleryUploads: [],
        removedGalleryPaths: [],
      }
    : {
        name: "",
        category: "Girls",
        price: "",
        cost: "",
        sizes: "",
        colors: "",
        stock: 1,
        image: null,
        emoji: "👕",
        tone: "bg-lilac",
        imagePath: null,
        imageIsLocal: false,
        removeImage: false,
        description: "",
        careInstructions: "",
        sizeGuide: "",
        gallery: [],
        galleryPaths: [],
        galleryUploads: [],
        removedGalleryPaths: [],
      };
}

async function prepareImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be smaller than 8 MB.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This image could not be processed.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.78);
}

function ProductThumbnail({ product }) {
  return (
    <div className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl ${product.tone || "bg-lilac"}`}>
      {product.image ? (
        <img src={product.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl" aria-hidden="true">{product.emoji || "👕"}</span>
      )}
    </div>
  );
}

export default function Admin() {
  const { products, loading, usingSample, error: catalogError } = useProducts();
  const [draft, setDraft] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardDays, setDashboardDays] = useState(30);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersNotice, setOrdersNotice] = useState("");
  const [ordersSearch, setOrdersSearch] = useState("");
  const ordersSearchValue = ordersSearch.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    if (!ordersSearchValue) return true;
    return [
      order.order_number,
      order.customer_name,
      order.email,
      order.phone,
      order.town,
      order.county,
    ].some((value) => String(value || "").toLowerCase().includes(ordersSearchValue));
  });
  const [savingDeliveryDetailsFor, setSavingDeliveryDetailsFor] = useState("");
  const [authError, setAuthError] = useState("");
  const [authStatus, setAuthStatus] = useState(isSupabaseConfigured ? "loading" : "demo");
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const availableCount = products.filter((product) => product.stock > 0).length;
  const soldOutCount = products.length - availableCount;

  useEffect(() => {
    if (!isSupabaseConfigured || authStatus !== "admin" || !["orders", "dashboard"].includes(activeTab)) return undefined;
    let active = true;
    setOrdersLoading(true);
    setOrdersError("");

    supabase
      .from("orders")
      .select("id,order_number,customer_name,email,phone,county,town,delivery_address,total_ksh,payment_method,payment_status,fulfillment_status,estimated_delivery_date,courier_name,courier_tracking_url,mpesa_receipt_number,created_at,order_items(product_name,size,color,quantity,unit_price_ksh,unit_cost_ksh)")
      .order("created_at", { ascending: false })
      .gte("created_at", new Date(Date.now() - (activeTab === "dashboard" ? dashboardDays : 3650) * 24 * 60 * 60 * 1000).toISOString())
      .limit(activeTab === "dashboard" ? 1000 : 100)
      .then(({ data, error: ordersQueryError }) => {
        if (!active) return;
        if (ordersQueryError) {
          setOrdersError(ordersQueryError.message);
        } else {
          setOrders(data ?? []);
        }
        setOrdersLoading(false);
      });

    return () => { active = false; };
  }, [activeTab, authStatus, dashboardDays]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setAuthError(sessionError.message);
        setAuthStatus("error");
        return;
      }
      setSession(data.session);
      setAuthStatus(data.session ? "checking" : "signed-out");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthStatus(nextSession ? "checking" : "signed-out");
      setAuthError("");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) return undefined;
    let active = true;

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error: roleError }) => {
        if (!active) return;
        if (roleError) {
          setAuthError(roleError.message);
          setAuthStatus("error");
        } else {
          setAuthStatus(data?.role === "admin" ? "admin" : "denied");
        }
      });

    return () => { active = false; };
  }, [session]);

  async function signIn(event) {
    event.preventDefault();
    setAuthError("");
    setAuthStatus("loading");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setAuthError(signInError.message);
      setAuthStatus("signed-out");
    }
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setAuthError(signOutError.message);
  }

  function updateCatalog(nextProducts) {
    try {
      saveCatalog(nextProducts);
      setError("");
      return true;
    } catch {
      setError("Could not save your changes in this browser. Try a smaller image or clear some browser storage.");
      return false;
    }
  }

  async function submitProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const nextProduct = {
      ...(draft.id !== undefined ? { id: draft.id } : { id: `local-${Date.now()}` }),
      name: String(form.get("name")).trim(),
      category: String(form.get("category")),
      price: Number(form.get("price")),
      cost: String(form.get("cost") ?? "").trim() === "" ? null : Number(form.get("cost")),
      sizes: String(form.get("sizes")).split(",").map((size) => size.trim()).filter(Boolean),
      colors: [...new Set(String(form.get("colors") || "").split(",").map((color) => color.trim()).filter(Boolean))],
      stock: Number(form.get("stock")),
      image: draft.image || null,
      emoji: draft.emoji || "👕",
      tone: draft.tone || "bg-lilac",
      description: String(form.get("description") || "").trim(),
      careInstructions: String(form.get("careInstructions") || "").trim(),
      sizeGuide: String(form.get("sizeGuide") || "").trim(),
      gallery: draft.gallery || [],
    };

    if (isSupabaseConfigured) {
      let uploadedPath = null;
      let imagePath = draft.imagePath;
      const uploadedGalleryPaths = [];
      try {
        if (draft.imageIsLocal && draft.image) {
          const blob = await (await fetch(draft.image)).blob();
          uploadedPath = `${nextProduct.category.toLowerCase()}/${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(uploadedPath, blob, { contentType: "image/jpeg", upsert: false });
          if (uploadError) throw uploadError;
          imagePath = uploadedPath;
        } else if (draft.removeImage) {
          imagePath = null;
        }

        for (const image of draft.galleryUploads || []) {
          const blob = await (await fetch(image)).blob();
          const path = `${nextProduct.category.toLowerCase()}/gallery-${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (uploadError) throw uploadError;
          uploadedGalleryPaths.push(path);
        }

        const retainedGalleryPaths = (draft.galleryPaths || []).filter(
          (path) => !(draft.removedGalleryPaths || []).includes(path)
        );
        const galleryPaths = [...retainedGalleryPaths, ...uploadedGalleryPaths].slice(0, 4);

        const row = {
          name: nextProduct.name,
          category: nextProduct.category,
          price_ksh: nextProduct.price,
          cost_ksh: nextProduct.cost,
          sizes: nextProduct.sizes,
          colors: nextProduct.colors,
          stock: nextProduct.stock,
          image_path: imagePath,
          emoji: nextProduct.emoji,
          tone: nextProduct.tone,
          description: nextProduct.description,
          care_instructions: nextProduct.careInstructions,
          size_guide: nextProduct.sizeGuide,
          gallery_paths: galleryPaths,
          active: true,
        };
        const query = draft.id
          ? supabase.from("products").update(row).eq("id", draft.id)
          : supabase.from("products").insert(row);
        const { error: saveError } = await query;
        if (saveError) throw saveError;

        if (draft.imagePath && draft.imagePath !== imagePath) {
          const { error: removeError } = await supabase.storage
            .from("product-images")
            .remove([draft.imagePath]);
          if (removeError) setError("Product saved, but its previous photo could not be removed.");
        }
        if ((draft.removedGalleryPaths || []).length) {
          await supabase.storage.from("product-images").remove(draft.removedGalleryPaths);
        }
        notifyProductsUpdated();
        setDraft(null);
      } catch (saveError) {
        if (uploadedPath) {
          await supabase.storage.from("product-images").remove([uploadedPath]);
        }
        if (uploadedGalleryPaths.length) {
          await supabase.storage.from("product-images").remove(uploadedGalleryPaths);
        }
        setError(saveError.message || "Could not save this product.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextProducts = draft.id !== undefined
      ? products.map((product) => product.id === draft.id ? nextProduct : product)
      : [nextProduct, ...products];

    if (updateCatalog(nextProducts)) setDraft(null);
    setSaving(false);
  }

  async function setAvailability(product, stock) {
    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase.from("products").update({ stock }).eq("id", product.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setError("");
        notifyProductsUpdated();
      }
      return;
    }
    updateCatalog(products.map((item) => item.id === product.id ? { ...item, stock } : item));
  }

  async function setOrderFulfillment(orderId, fulfillmentStatus) {
    setOrdersError("");
    setOrdersNotice("");
    const { error: updateError } = await supabase
      .from("orders")
      .update({ fulfillment_status: fulfillmentStatus })
      .eq("id", orderId);
    if (updateError) {
      setOrdersError(updateError.message);
      return;
    }
    setOrders((current) => current.map((order) =>
      order.id === orderId ? { ...order, fulfillment_status: fulfillmentStatus } : order
    ));
  }

  async function saveOrderDeliveryDetails(orderId, event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const estimatedDeliveryDate = String(form.get("estimatedDeliveryDate") || "");
    const courierName = String(form.get("courierName") || "").trim();
    const rawTrackingUrl = String(form.get("courierTrackingUrl") || "").trim();
    const courierTrackingUrl = rawTrackingUrl ? getSafeTrackingUrl(rawTrackingUrl) : null;

    if (rawTrackingUrl && !courierTrackingUrl) {
      setOrdersError("Enter a valid HTTPS courier tracking link.");
      setOrdersNotice("");
      return;
    }

    setOrdersError("");
    setOrdersNotice("");
    setSavingDeliveryDetailsFor(orderId);
    const updates = {
      estimated_delivery_date: estimatedDeliveryDate || null,
      courier_name: courierName || null,
      courier_tracking_url: courierTrackingUrl,
    };
    const { error: updateError } = await supabase.from("orders").update(updates).eq("id", orderId);
    setSavingDeliveryDetailsFor("");
    if (updateError) {
      setOrdersError(updateError.message);
      return;
    }

    setOrders((current) => current.map((order) =>
      order.id === orderId ? { ...order, ...updates } : order
    ));
    setOrdersNotice("Delivery details saved.");
  }

  async function markCashOrderPaid(orderId) {
    setOrdersError("");
    const { error: updateError } = await supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", orderId);
    if (updateError) {
      setOrdersError(updateError.message);
      return;
    }
    setOrders((current) => current.map((order) =>
      order.id === orderId ? { ...order, payment_status: "paid" } : order
    ));
  }

  async function cancelOrder(orderId, orderNumber) {
    if (!window.confirm(`Cancel ${orderNumber} and restore its reserved stock?`)) return;
    setOrdersError("");
    setOrdersNotice("");
    const { error: cancelError } = await supabase.rpc("cancel_store_order", {
      p_order_id: orderId,
      p_result_description: "Cancelled by store administrator",
    });
    if (cancelError) {
      setOrdersError(cancelError.message);
      return;
    }
    setOrders((current) => current.map((order) =>
      order.id === orderId
        ? { ...order, payment_status: "failed", fulfillment_status: "awaiting_payment" }
        : order
    ));
    setOrdersNotice(`${orderNumber} was cancelled and its stock was restored.`);
  }

  async function removeProduct(product) {
    if (!window.confirm(`Remove "${product.name}" from the shop?`)) return;
    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase.from("products").update({ active: false }).eq("id", product.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setError("");
        notifyProductsUpdated();
      }
      return;
    }
    updateCatalog(products.filter((item) => item.id !== product.id));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    setError("");
    try {
      const image = await prepareImage(file);
      setDraft((current) => ({ ...current, image, imageIsLocal: true, removeImage: false }));
    } catch (imageError) {
      setError(imageError.message || "Could not read this image.");
    } finally {
      setImageLoading(false);
      event.target.value = "";
    }
  }

  async function handleGalleryChange(event) {
    const files = Array.from(event.target.files || []).slice(0, 4);
    if (!files.length) return;
    setImageLoading(true);
    setError("");
    try {
      const images = await Promise.all(files.map(prepareImage));
      setDraft((current) => ({
        ...current,
        gallery: [...(current.gallery || []), ...images].slice(0, 4),
        galleryUploads: [...(current.galleryUploads || []), ...images],
      }));
    } catch (galleryError) {
      setError(galleryError.message || "Could not read one of these images.");
    } finally {
      setImageLoading(false);
      event.target.value = "";
    }
  }

  if (isSupabaseConfigured && authStatus !== "admin") {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <header className="border-b border-purple-mid/30 bg-purple-soft px-5 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <p className="font-display text-xl font-extrabold">KZZ Admin</p>
            <Link to="/" className="text-sm font-bold underline">Back to shop</Link>
          </div>
        </header>
        <main className="mx-auto max-w-md px-5 py-16">
          <div className="rounded-3xl border border-purple-mid/40 bg-purple-soft p-6 sm:p-8">
            <p className="text-sm font-bold text-purple-vivid">STORE MANAGEMENT</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold">
              {authStatus === "denied" ? "Admin access required" : "Sign in to KZZ"}
            </h1>
            {authStatus === "loading" || authStatus === "checking" ? (
              <p className="mt-4 text-sm text-ink/65">Checking admin access…</p>
            ) : authStatus === "denied" ? (
              <>
                <p className="mt-3 text-sm leading-6 text-ink/65">This account is not listed as a store admin. Ask the project owner to grant the admin role in Supabase.</p>
                <button type="button" onClick={signOut} className="mt-5 font-bold underline">Sign out</button>
              </>
            ) : authStatus === "error" ? (
              <p role="alert" className="mt-4 text-sm text-red-700">{authError || "Could not verify admin access."}</p>
            ) : (
              <form onSubmit={signIn} className="mt-5 space-y-4">
                <label className="block text-sm font-bold">
                  Email
                  <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-4 py-3 font-normal" />
                </label>
                <label className="block text-sm font-bold">
                  Password
                  <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-4 py-3 font-normal" />
                </label>
                {authError && <p role="alert" className="text-sm text-red-700">{authError}</p>}
                <button type="submit" disabled={authStatus === "loading"} className="w-full rounded-full bg-purple-deep py-3 font-bold text-white hover:bg-purple-vivid disabled:opacity-50">
                  Sign in
                </button>
              </form>
            )}
            {!authError && authStatus === "signed-out" && <p className="mt-4 text-xs leading-5 text-ink/55">Create the admin account in Supabase Auth, then grant it the admin role using the setup SQL.</p>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-purple-mid/30 bg-purple-soft">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-lilac font-display text-lg font-extrabold">K</span>
            <div>
              <p className="font-display text-lg font-extrabold leading-tight">KZZ Admin</p>
              <p className="text-xs text-ink/55">Store management</p>
            </div>
          </div>
          <Link to="/" className="rounded-full border border-ink/15 px-4 py-2 text-sm font-bold transition-colors hover:bg-lilac/60">
            View shop
          </Link>
          {isSupabaseConfigured && (
            <button type="button" onClick={signOut} className="text-sm font-bold text-purple-vivid underline">
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-bold text-coral">Your shop, at a glance</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {activeTab === "dashboard" ? "Overview" : activeTab === "products" ? "Products" : "Orders"}
            </h1>
          </div>
          {activeTab === "products" && (
            <button
              type="button"
              onClick={() => { setError(""); setDraft(createDraft()); }}
              disabled={loading}
              className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-coral disabled:cursor-wait disabled:opacity-50"
            >
              + Add a product
            </button>
          )}
        </div>

        {(
          <div className="mb-6 flex w-fit gap-1 rounded-full bg-purple-soft p-1">
            {[
              ["dashboard", "Overview"],
              ["products", "Products"],
              ["orders", "Orders"],
            ].map(([tab, title]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-pressed={activeTab === tab}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${activeTab === tab ? "bg-purple-deep text-purple-tint" : "hover:bg-purple-tint"}`}
              >
                {title}
              </button>
            ))}
          </div>
        )}

        {activeTab === "dashboard" && (
          <AdminDashboard
            products={products}
            orders={orders}
            loading={ordersLoading}
            error={ordersError}
            days={dashboardDays}
            onDaysChange={setDashboardDays}
            usingSample={usingSample}
          />
        )}

        {activeTab === "products" && (
          <>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Total listings", products.length],
            ["Available", availableCount],
            ["Sold out", soldOutCount],
          ].map(([label, count]) => (
            <div key={label} className="rounded-2xl border border-purple-mid/30 bg-purple-tint p-4">
              <p className="text-sm text-ink/60">{label}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{loading ? "—" : count}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-2xl border border-purple-mid/50 bg-purple-soft px-4 py-3 text-sm leading-6 text-ink/75">
          Homepage collection photos use the first product photo in each category. Edit a product photo below to update its collection card.
          {!isSupabaseConfigured && " Changes are saved only in this browser until Supabase is configured."}
          {usingSample && <span className="ml-1 font-bold">You’re editing the sample catalog.</span>}
        </div>

        {error && (
          <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {catalogError && (
          <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load the catalog: {catalogError}
          </p>
        )}

        <section className="overflow-hidden rounded-2xl border border-purple-mid/30 bg-purple-tint">
          <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_auto] gap-4 border-b border-ink/10 bg-paper px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink/55 sm:grid">
            <span>Product</span><span>Category</span><span>Price · stock</span><span>Actions</span>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-ink/60">Loading products…</p>
          ) : products.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-display text-xl font-bold">No products yet</p>
              <p className="mt-1 text-sm text-ink/60">Add your first listing to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-ink/10">
              {products.map((product) => (
                <article key={product.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] sm:items-center sm:gap-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductThumbnail product={product} />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{product.name}</p>
                      <p className="text-sm text-ink/55">{product.sizes.join(" · ")}</p>
                    </div>
                  </div>
                  <p className="text-sm text-ink/70">{product.category}</p>
                  <div>
                    <p className="text-sm font-bold">{formatKSh(product.price)}</p>
                    <p className={`text-xs ${product.stock > 0 ? "text-ink/55" : "font-bold text-coral"}`}>
                      {product.stock > 0 ? `${product.stock} in stock` : "Sold out"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setError(""); setDraft(createDraft(product)); }}
                      className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold hover:bg-lilac/60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvailability(product, product.stock > 0 ? 0 : 1)}
                      className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold hover:bg-lilac/60"
                    >
                      {product.stock > 0 ? "Mark sold" : "Restock"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProduct(product)}
                      className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-coral hover:bg-blush/60"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
          </>
        )}

        {activeTab === "orders" && (
          <section className="space-y-4">
            {ordersError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{ordersError}</p>}
            {ordersNotice && <p role="status" className="rounded-xl bg-purple-soft px-4 py-3 text-sm text-ink/75">{ordersNotice}</p>}
            <label className="block rounded-2xl border border-purple-mid/40 bg-purple-tint p-4 text-sm font-bold">
              Search orders
              <input
                type="search"
                value={ordersSearch}
                onChange={(event) => setOrdersSearch(event.target.value)}
                placeholder="Order number, customer, phone or email"
                className="mt-2 w-full rounded-xl border border-purple-mid/60 bg-purple-soft px-4 py-3 font-normal"
              />
            </label>
            {ordersLoading ? (
              <p className="rounded-2xl bg-purple-soft p-6 text-sm text-ink/65">Loading orders…</p>
            ) : filteredOrders.length === 0 ? (
              <p className="rounded-2xl bg-purple-soft p-8 text-center text-sm text-ink/65">No orders yet. Paid and pending M-Pesa orders will appear here.</p>
            ) : filteredOrders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-purple-mid/40 bg-purple-tint p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-extrabold">{order.order_number}</p>
                    <p className="mt-1 text-sm text-ink/60">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${order.payment_status === "paid" ? "bg-mint text-ink" : order.payment_status === "failed" ? "bg-blush text-ink" : "bg-purple-soft text-purple-deep"}`}>
                      Payment: {order.payment_status}
                    </span>
                    {order.payment_method === "cash_on_delivery" && order.payment_status === "pending" && order.fulfillment_status === "delivered" && (
                      <button
                        type="button"
                        onClick={() => markCashOrderPaid(order.id)}
                        className="rounded-full border border-purple-mid/60 px-3 py-1.5 text-xs font-bold hover:bg-purple-soft"
                      >
                        Mark cash received
                      </button>
                    )}
                    {order.payment_status !== "failed" && (
                      <button
                        type="button"
                        onClick={() => cancelOrder(order.id, order.order_number)}
                        className="rounded-full border border-coral/50 px-3 py-1.5 text-xs font-bold text-coral hover:bg-blush/60"
                      >
                        Cancel & restore stock
                      </button>
                    )}
                    {(order.payment_status === "paid" || order.payment_method === "cash_on_delivery") && (
                      <label className="flex items-center gap-2 text-xs font-bold">
                        Delivery
                        <select
                          value={order.fulfillment_status}
                          onChange={(event) => setOrderFulfillment(order.id, event.target.value)}
                          className="rounded-full border border-purple-mid/60 bg-purple-tint px-3 py-1.5 text-xs"
                          aria-label={`Delivery status for ${order.order_number}`}
                        >
                          {ORDER_FULFILLMENT_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 border-t border-purple-mid/30 pt-4 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <p className="font-bold">{order.customer_name}</p>
                    <p className="text-sm text-ink/65">{order.email} · {order.phone}</p>
                  </div>
                  <p className="text-sm leading-6 text-ink/65">{order.delivery_address}, {order.town}, {order.county}</p>
                  <p className="font-display text-lg font-extrabold">{formatKSh(order.total_ksh)}</p>
                </div>
                <p className="mt-2 text-xs font-bold text-ink/60">
                  Payment method: {order.payment_method === "cash_on_delivery" ? "Cash on delivery" : "M-Pesa"}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-ink/70">
                  {(order.order_items ?? []).map((item) => (
                    <li key={`${item.product_name}-${item.size}-${item.color || ""}`}>{item.quantity} × {item.product_name} · {item.size}{item.color ? ` · ${item.color}` : ""}</li>
                  ))}
                </ul>
                {order.mpesa_receipt_number && <p className="mt-3 text-xs font-bold text-purple-vivid">M-Pesa receipt: {order.mpesa_receipt_number}</p>}
                {(order.payment_status === "paid" || order.payment_method === "cash_on_delivery") && (
                  <form onSubmit={(event) => saveOrderDeliveryDetails(order.id, event)} className="mt-4 grid gap-3 border-t border-purple-mid/30 pt-4 sm:grid-cols-3">
                    <label className="text-xs font-bold">
                      Estimated delivery
                      <input
                        type="date"
                        name="estimatedDeliveryDate"
                        defaultValue={order.estimated_delivery_date || ""}
                        className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-soft px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-bold">
                      Courier
                      <input
                        type="text"
                        name="courierName"
                        maxLength={120}
                        defaultValue={order.courier_name || ""}
                        placeholder="Courier or delivery service"
                        className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-soft px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-bold">
                      Courier tracking link
                      <input
                        type="url"
                        name="courierTrackingUrl"
                        maxLength={1000}
                        defaultValue={order.courier_tracking_url || ""}
                        placeholder="https://..."
                        className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-soft px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={savingDeliveryDetailsFor === order.id}
                      className="w-fit rounded-full border border-purple-mid/60 px-4 py-2 text-xs font-bold hover:bg-purple-soft disabled:opacity-50 sm:col-span-3"
                    >
                      {savingDeliveryDetailsFor === order.id ? "Saving…" : "Save delivery details"}
                    </button>
                  </form>
                )}
              </article>
            ))}
          </section>
        )}
      </main>

      {draft && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-ink/35 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
            onSubmit={submitProduct}
            className="my-auto w-full max-w-xl rounded-3xl bg-purple-tint p-5 shadow-xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-coral">{draft.id !== undefined ? "Update listing" : "New listing"}</p>
                <h2 id="product-form-title" className="font-display text-2xl font-extrabold">{draft.id !== undefined ? "Edit product" : "Add a product"}</h2>
              </div>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close form" className="grid h-9 w-9 place-items-center rounded-full bg-paper font-bold">×</button>
            </div>

            <label className="mb-4 block text-sm font-bold">
              Product name
              <input name="name" required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" placeholder="e.g. Cotton play set" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="mb-4 block text-sm font-bold">
                Category
                <select name="category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-ink/15 bg-purple-soft px-4 py-3 font-normal">
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="mb-4 block text-sm font-bold">
                Price (KSh)
                <input name="price" type="number" min="0" step="1" required value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="mt-1.5 w-full rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" />
              </label>
              <label className="mb-4 block text-sm font-bold">
                Product cost (KSh)
                <input name="cost" type="number" min="0" step="1" value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} className="mt-1.5 w-full rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" placeholder="Optional" />
                <span className="mt-1 block text-xs font-normal text-ink/55">Used to estimate gross profit on future orders.</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="mb-4 block text-sm font-bold">
                Sizes
                <input name="sizes" required value={draft.sizes} onChange={(event) => setDraft({ ...draft, sizes: event.target.value })} className="mt-1.5 w-full rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" placeholder="2Y, 3Y, 4Y" />
              </label>
              <label className="mb-4 block text-sm font-bold">
                Quantity available
                <input name="stock" type="number" min="0" step="1" required value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} className="mt-1.5 w-full rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" />
              </label>
            </div>

            <label className="mb-4 block text-sm font-bold">
              Available colours
              <input name="colors" value={draft.colors} onChange={(event) => setDraft({ ...draft, colors: event.target.value })} className="mt-1.5 w-full rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" placeholder="Pink, Blue, Cream" />
              <span className="mt-1 block text-xs font-normal text-ink/55">Separate colours with commas. All colours share the quantity above.</span>
            </label>

            <div className="mb-6">
              <p className="mb-2 text-sm font-bold">Product photo</p>
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-lilac">
                  {draft.image ? <img src={draft.image} alt="Product preview" className="h-full w-full object-cover" /> : <span className="text-3xl">{draft.emoji || "👕"}</span>}
                </div>
                <label className="cursor-pointer rounded-full border border-ink/15 px-4 py-2 text-sm font-bold hover:bg-lilac/60">
                  {imageLoading ? "Preparing photo…" : "Choose image"}
                  <input type="file" accept="image/*" disabled={imageLoading} onChange={handleImageChange} className="sr-only" />
                </label>
                {draft.image && <button type="button" onClick={() => setDraft({ ...draft, image: null, imageIsLocal: false, removeImage: Boolean(draft.imagePath) })} className="text-sm font-bold text-coral underline">Remove image</button>}
              </div>
              <p className="mt-2 text-xs text-ink/55">{isSupabaseConfigured ? "Images are resized before uploading to Supabase Storage." : "Images are resized to fit this browser’s local storage."}</p>
            </div>

            <label className="mb-4 block text-sm font-bold">
              Product description
              <textarea name="description" rows={3} maxLength={800} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" placeholder="What makes this outfit special?" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="mb-4 block text-sm font-bold">
                Care instructions
                <textarea name="careInstructions" rows={3} maxLength={500} value={draft.careInstructions} onChange={(event) => setDraft({ ...draft, careInstructions: event.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" placeholder="Machine wash cold…" />
              </label>
              <label className="mb-4 block text-sm font-bold">
                Size guide
                <textarea name="sizeGuide" rows={3} maxLength={500} value={draft.sizeGuide} onChange={(event) => setDraft({ ...draft, sizeGuide: event.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-purple-mid/50 bg-purple-soft px-4 py-3 font-normal" placeholder="2Y – 92 cm height…" />
              </label>
            </div>

            <div className="mb-6">
              <p className="mb-2 text-sm font-bold">Gallery photos <span className="font-normal text-ink/55">(up to 4)</span></p>
              <div className="grid grid-cols-4 gap-2">
                {(draft.gallery || []).slice(0, 4).map((image, index) => (
                  <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-lilac">
                    <img src={image} alt={`Gallery preview ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove gallery photo ${index + 1}`}
                      onClick={() => {
                        const path = draft.galleryPaths?.[index];
                        setDraft({
                          ...draft,
                          gallery: draft.gallery.filter((_, itemIndex) => itemIndex !== index),
                          removedGalleryPaths: path
                            ? [...(draft.removedGalleryPaths || []), path]
                            : draft.removedGalleryPaths || [],
                        });
                      }}
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {(draft.gallery || []).length < 4 && (
                  <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-purple-mid text-2xl hover:bg-purple-soft">
                    +
                    <input type="file" multiple accept="image/*" onChange={handleGalleryChange} className="sr-only" />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-ink/55">The main photo and gallery images can be removed independently.</p>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDraft(null)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-paper">Cancel</button>
              <button type="submit" disabled={imageLoading || saving} className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-coral disabled:opacity-50">
                {saving ? "Saving…" : "Save product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
