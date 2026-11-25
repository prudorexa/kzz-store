import { useEffect, useMemo, useState } from "react";
import { nairobiDateTimeToIso } from "../lib/offerSchedule.js";
import { PRODUCT_GROUPS } from "../lib/productGroups.js";

const audienceCategories = ["Boys", "Girls", "Baby"];
const MAX_PHOTOS_PER_PRODUCT = 5;
const IMPORTED_PHOTOS_KEY = "kzz.imported-public-photos";

function readImportedPhotoNames() {
  try {
    const saved = window.localStorage.getItem(IMPORTED_PHOTOS_KEY);
    return new Set(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set();
  }
}

export default function PublicPhotoImporter({ onImport, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [importedNames, setImportedNames] = useState(readImportedPhotoNames);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Girls");
  const [productGroup, setProductGroup] = useState("Sets");
  const [name, setName] = useState("");
  const [sizes, setSizes] = useState("");
  const [price, setPrice] = useState("1600");
  const [previousPrice, setPreviousPrice] = useState("");
  const [offerStartsAt, setOfferStartsAt] = useState("");
  const [offerEndsAt, setOfferEndsAt] = useState("");
  const [stock, setStock] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/public-photo-manifest.json")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the public photo list.");
        return response.json();
      })
      .then((items) => {
        if (active) setPhotos(items);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load the public photo list.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!previewPhoto) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPreviewPhoto(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewPhoto]);

  const visiblePhotos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? photos.filter((photo) => photo.name.toLowerCase().includes(query)) : photos;
  }, [photos, search]);

  function togglePhoto(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PHOTOS_PER_PRODUCT) next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const photo of visiblePhotos) {
        if (next.size >= MAX_PHOTOS_PER_PRODUCT) break;
        next.add(photo.id);
      }
      return next;
    });
  }

  async function submitProduct(event) {
    event.preventDefault();
    if (!selectedIds.size || !name.trim() || !sizes.trim()) return;
    const parsedPreviousPrice = previousPrice.trim() === "" ? null : Number(previousPrice);
    if (parsedPreviousPrice != null && parsedPreviousPrice <= Number(price)) {
      setError("Previous price must be greater than the current price.");
      return;
    }
    const startsAt = parsedPreviousPrice == null ? null : nairobiDateTimeToIso(offerStartsAt);
    const endsAt = parsedPreviousPrice == null ? null : nairobiDateTimeToIso(offerEndsAt);
    if (
      (parsedPreviousPrice != null && offerStartsAt && !startsAt) ||
      (parsedPreviousPrice != null && offerEndsAt && !endsAt) ||
      (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt))
    ) {
      setError("Enter valid offer dates and make sure the end is after the start.");
      return;
    }

    const selectedPhotos = photos.filter((photo) => selectedIds.has(photo.id));
    const product = {
      name: name.trim(),
      category,
      productGroup,
      sizes: [...new Set(sizes.split(",").map((size) => size.trim()).filter(Boolean))],
      price: Number(price),
      originalPrice: parsedPreviousPrice,
      offerStartsAt: startsAt,
      offerEndsAt: endsAt,
      stock: Number(stock),
      photos: selectedPhotos,
    };

    setSaving(true);
    setProgress(0);
    setError("");
    setNotice("");
    try {
      const result = await onImport(product, setProgress);
      if (result.importedIds.length) {
        const importedIds = new Set(result.importedIds);
        const importedBatchNames = selectedPhotos.filter((photo) => importedIds.has(photo.id)).map((photo) => photo.name);
        const nextImportedNames = new Set([...importedNames, ...importedBatchNames]);
        setImportedNames(nextImportedNames);
        try {
          window.localStorage.setItem(IMPORTED_PHOTOS_KEY, JSON.stringify([...nextImportedNames]));
        } catch {
          setError("The product was saved, but this browser could not remember which photos were imported. Re-importing may create duplicates.");
        }
        setSelectedIds((current) => new Set([...current].filter((id) => !importedIds.has(id))));
      }
      const added = result.importedIds.length > 0;
      setNotice(added ? `"${product.name}" was added with ${result.importedIds.length} photo${result.importedIds.length === 1 ? "" : "s"}.` : "");
      if (result.failures.length) {
        setError(result.failures.slice(0, 3).map((failure) => `${failure.name}: ${failure.message}`).join(" "));
      }
    } catch (importError) {
      setError(importError.message || "Could not import this product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/40 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-photo-import-title"
        className="mx-auto my-4 max-w-6xl rounded-3xl bg-purple-tint p-5 shadow-xl sm:my-8 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-coral">BULK PRODUCT IMPORT</p>
            <h2 id="public-photo-import-title" className="mt-1 font-display text-2xl font-extrabold">Create a product from public photos</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              Select up to five photos of the same product. The first is the main image and the rest become gallery photos.
              Photos stay on this site; no AI service receives them.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-paper px-4 py-2 text-sm font-bold">Close</button>
        </div>

        <form onSubmit={submitProduct} className="mt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-bold">
              Product name
              <input required value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="e.g. Blue formal suit set" className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-bold">
              Audience
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal">
                {audienceCategories.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">
              Clothing group
              <select value={productGroup} onChange={(event) => setProductGroup(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal">
                {PRODUCT_GROUPS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">
              Ages / sizes
              <input required value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="e.g. 8-9Y, 10-11Y" className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-bold">
              {previousPrice ? "Offer price (KSh)" : "Current price (KSh)"}
              <input type="number" min="0" step="1" required value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-bold">
              Previous price (optional)
              <input type="number" min={Number(price) + 1} step="1" value={previousPrice} onChange={(event) => setPreviousPrice(event.target.value)} placeholder="Leave blank if no offer" className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-bold">
              Offer starts (EAT, optional)
              <input type="datetime-local" value={offerStartsAt} disabled={!previousPrice} onChange={(event) => setOfferStartsAt(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal disabled:opacity-50" />
            </label>
            <label className="text-sm font-bold">
              Offer ends (EAT, optional)
              <input type="datetime-local" value={offerEndsAt} disabled={!previousPrice} onChange={(event) => setOfferEndsAt(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal disabled:opacity-50" />
            </label>
            <label className="text-sm font-bold">
              Stock
              <input type="number" min="0" step="1" required value={stock} onChange={(event) => setStock(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal" />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-bold">
              Find a photo
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search filenames" className="ml-2 rounded-xl border border-ink/15 bg-white px-3 py-2 font-normal" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink/60">{selectedIds.size}/{MAX_PHOTOS_PER_PRODUCT} selected · {photos.length} photos</span>
              <span className="text-xs text-ink/60">Click a photo to preview it full size.</span>
              <button type="button" onClick={selectVisible} className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold">Select visible</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold">Clear selection</button>
            </div>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-ink">{notice}</p>}

          {loading ? (
            <p className="py-12 text-center text-sm text-ink/60">Loading photos…</p>
          ) : (
            <div className="mt-4 grid max-h-[50vh] gap-3 overflow-y-auto rounded-2xl border border-purple-mid/40 bg-white p-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {visiblePhotos.map((photo) => (
                <div key={photo.id} className={`overflow-hidden rounded-xl border-2 ${selectedIds.has(photo.id) ? "border-purple-vivid bg-purple-soft" : "border-transparent bg-paper"}`}>
                  <button type="button" onClick={() => setPreviewPhoto(photo)} aria-label={`Preview ${photo.name}`} className="block w-full bg-white">
                    <img src={photo.url} alt="" loading="lazy" className="aspect-[3/4] w-full object-contain" />
                  </button>
                  <label className="flex cursor-pointer items-start gap-2 p-2 text-xs">
                    <input type="checkbox" checked={selectedIds.has(photo.id)} onChange={() => togglePhoto(photo.id)} disabled={!selectedIds.has(photo.id) && selectedIds.size >= MAX_PHOTOS_PER_PRODUCT} className="mt-0.5" />
                    <span className="line-clamp-2 break-all">{importedNames.has(photo.name) ? "Previously added · " : ""}{photo.name}</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-ink/55">
              Group only photos of the same product. Enter all age labels available for it; the gallery can then filter by clothing group and size. Previously added photos can be selected again.
            </p>
            <button type="submit" disabled={saving || loading || !selectedIds.size || !name.trim() || !sizes.trim()} className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? `Saving ${progress}/${selectedIds.size} photos…` : "Save product"}
            </button>
          </div>
        </form>
      </section>
      {previewPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Full-size preview: ${previewPhoto.name}`}
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="flex max-h-full w-full max-w-5xl flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-4 text-white">
              <p className="break-all text-sm font-bold">{previewPhoto.name}</p>
              <button type="button" onClick={() => setPreviewPhoto(null)} className="shrink-0 rounded-full bg-white/15 px-4 py-2 text-sm font-bold">Close</button>
            </div>
            <img src={previewPhoto.url} alt={previewPhoto.name} className="max-h-[85vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
