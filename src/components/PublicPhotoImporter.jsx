import { useEffect, useMemo, useState } from "react";
import { nairobiDateTimeToIso } from "../lib/offerSchedule.js";
import { embedPhotos, groupSimilarEmbeddings } from "../lib/photoGrouping.js";
import { PRODUCT_GROUPS } from "../lib/productGroups.js";

const audienceCategories = ["Boys", "Girls", "Baby"];
const MAX_PHOTOS_PER_PRODUCT = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.9;
const IMPORTED_PHOTOS_KEY = "kzz.imported-public-photos";

function readImportedPhotoNames() {
  try {
    const saved = window.localStorage.getItem(IMPORTED_PHOTOS_KEY);
    return new Set(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set();
  }
}

export default function PublicPhotoImporter({ onImportBatch, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [importedNames, setImportedNames] = useState(readImportedPhotoNames);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batch, setBatch] = useState([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState(() => new Set());
  const [analysis, setAnalysis] = useState(null);
  const [similarityThreshold, setSimilarityThreshold] = useState(DEFAULT_SIMILARITY_THRESHOLD);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisTotal, setAnalysisTotal] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
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
  const [progressTotal, setProgressTotal] = useState(0);
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
  const selectedPhotosInOrder = useMemo(
    () => photos.filter((photo) => selectedIds.has(photo.id)),
    [photos, selectedIds]
  );
  const batchedPhotoIds = useMemo(
    () => new Set(batch.flatMap((item) => item.product.photos.map((photo) => photo.id))),
    [batch]
  );
  const suggestedPhotoGroups = useMemo(() => {
    if (!analysis) return [];
    const groups = [
      ...groupSimilarEmbeddings(analysis.embeddings, similarityThreshold)
        .map((indices) => indices.map((index) => analysis.photos[index])),
      ...analysis.failures.map(({ photo }) => [photo]),
    ];
    const photoOrder = new Map(photos.map((photo, index) => [photo.id, index]));
    return groups.sort((left, right) => photoOrder.get(left[0].id) - photoOrder.get(right[0].id));
  }, [analysis, photos, similarityThreshold]);
  const similarGroupCount = suggestedPhotoGroups.filter((group) => group.length > 1).length;

  function togglePhoto(id) {
    if (batchedPhotoIds.has(id)) return;
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
        if (batchedPhotoIds.has(photo.id)) continue;
        next.add(photo.id);
      }
      return next;
    });
  }

  function getProductDefaults() {
    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    if (!sizes.trim()) {
      setError("Enter the sizes that apply to these products.");
      return null;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isFinite(parsedStock) || parsedStock < 0) {
      setError("Enter a valid price and stock quantity.");
      return null;
    }

    const parsedPreviousPrice = previousPrice.trim() === "" ? null : Number(previousPrice);
    if (parsedPreviousPrice != null && (!Number.isFinite(parsedPreviousPrice) || parsedPreviousPrice <= parsedPrice)) {
      setError("Previous price must be greater than the current price.");
      return null;
    }
    const startsAt = parsedPreviousPrice == null ? null : nairobiDateTimeToIso(offerStartsAt);
    const endsAt = parsedPreviousPrice == null ? null : nairobiDateTimeToIso(offerEndsAt);
    if (
      (parsedPreviousPrice != null && offerStartsAt && !startsAt) ||
      (parsedPreviousPrice != null && offerEndsAt && !endsAt) ||
      (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt))
    ) {
      setError("Enter valid offer dates and make sure the end is after the start.");
      return null;
    }

    return {
      category,
      productGroup,
      sizes: [...new Set(sizes.split(",").map((size) => size.trim()).filter(Boolean))],
      price: parsedPrice,
      originalPrice: parsedPreviousPrice,
      offerStartsAt: startsAt,
      offerEndsAt: endsAt,
      stock: parsedStock,
    };
  }

  function stageProduct(event) {
    event.preventDefault();
    if (saving || analyzing || !selectedIds.size || !name.trim()) return;
    const defaults = getProductDefaults();
    if (!defaults) return;

    const selectedPhotos = selectedPhotosInOrder;
    const product = {
      ...defaults,
      name: name.trim(),
      photos: selectedPhotos,
    };

    setBatch((current) => [
      ...current,
      { id: `${Date.now()}-${selectedPhotos[0].id}`, product },
    ]);
    setSelectedIds(new Set());
    setName("");
    setError("");
    setNotice(`"${product.name}" is ready in the batch. Add another product or save the batch.`);
  }

  async function analyzePhotoLibrary() {
    if (loading || saving || analyzing) return;
    const candidates = photos.filter((photo) => (
      !importedNames.has(photo.name) && !batchedPhotoIds.has(photo.id)
    ));
    if (!candidates.length) {
      setNotice("All available photos have already been added or staged.");
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisProgress(0);
    setAnalysisTotal(candidates.length);
    setAnalysisStatus("Preparing analysis…");
    setSelectedIds(new Set());
    setError("");
    setNotice("");
    try {
      const result = await embedPhotos(
        candidates,
        (completed) => setAnalysisProgress(completed),
        (status) => setAnalysisStatus(status)
      );
      setAnalysis(result);
      setNotice(
        `Analyzed ${candidates.length} photos. Review the suggested groups below, adjust strictness, then add them to the batch.`
      );
      if (result.failures.length) {
        setError(`${result.failures.length} photo${result.failures.length === 1 ? "" : "s"} could not be analyzed and will be added as single-photo products.`);
      }
    } catch (analysisError) {
      setError(analysisError.message || "Could not load the on-device visual model.");
    } finally {
      setAnalyzing(false);
      setAnalysisStatus("");
    }
  }

  function addSuggestedGroupsToBatch() {
    const defaults = getProductDefaults();
    if (!defaults || !suggestedPhotoGroups.length) return;

    const suggestions = suggestedPhotoGroups.map((group, index) => ({
      id: `suggested-${Date.now()}-${index}`,
      product: {
        ...defaults,
        name: `Outfit ${String(batch.length + index + 1).padStart(3, "0")}`,
        photos: group,
      },
    }));
    setBatch((current) => [...current, ...suggestions]);
    setSelectedIds(new Set());
    setSelectedBatchIds(new Set());
    setAnalysis(null);
    setError("");
    setNotice(`Added ${suggestions.length} suggested product${suggestions.length === 1 ? "" : "s"} to the batch. Review the groups before saving.`);
  }

  function applyDefaultsToBatch() {
    const defaults = getProductDefaults();
    if (!defaults || !batch.length) return;
    setBatch((current) => current.map((item) => ({
      ...item,
      product: { ...item.product, ...defaults },
    })));
    setNotice("Current category, sizes, price, offer, and stock applied to every batch product.");
  }

  function toggleBatchSelection(id) {
    setSelectedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function mergeSelectedGroups() {
    const selected = batch.filter((item) => selectedBatchIds.has(item.id));
    if (selected.length < 2) return;
    const [target] = selected;
    const selectedIdsToMerge = new Set(selected.map((item) => item.id));
    const uniquePhotos = [...new Map(selected.flatMap((item) => item.product.photos).map((photo) => [photo.id, photo])).values()];
    setBatch((current) => current.flatMap((item) => {
      if (item.id === target.id) {
        return [{ ...target, product: { ...target.product, photos: uniquePhotos } }];
      }
      return selectedIdsToMerge.has(item.id) ? [] : [item];
    }));
    setSelectedBatchIds(new Set());
    setNotice(`Merged ${selected.length} groups into "${target.product.name}".`);
  }

  function splitPhotoFromGroup(groupId, photo) {
    setBatch((current) => current.flatMap((item) => {
      if (item.id !== groupId || item.product.photos.length < 2) return [item];
      const remainingPhotos = item.product.photos.filter((itemPhoto) => itemPhoto.id !== photo.id);
      return [
        { ...item, product: { ...item.product, photos: remainingPhotos } },
        {
          id: `split-${Date.now()}-${photo.id}`,
          product: { ...item.product, name: `${item.product.name} (separate)`, photos: [photo] },
        },
      ];
    }));
    setSelectedBatchIds((current) => {
      const next = new Set(current);
      next.delete(groupId);
      return next;
    });
  }

  async function saveBatch() {
    if (saving || !batch.length) return;
    const unnamedProducts = batch.filter((item) => !item.product.name.trim());
    if (unnamedProducts.length) {
      setError("Give every product a name before saving the batch.");
      return;
    }
    setSaving(true);
    setProgress(0);
    setProgressTotal(batch.reduce((total, item) => total + item.product.photos.length, 0));
    setError("");
    setNotice("");
    const importedPhotoIds = new Set();
    const failures = [];
    let importedProducts = 0;
    try {
      const { results } = await onImportBatch(
        batch.map((item) => item.product),
        (completed) => setProgress(completed)
      );
      for (const [index, item] of batch.entries()) {
        const result = results[index];
        if (!result) {
          failures.push(`${item.product.name}: no import result was returned.`);
          continue;
        }
        const importedIds = new Set(result.importedIds);
        for (const photo of item.product.photos) {
          if (importedIds.has(photo.id)) importedPhotoIds.add(photo.id);
        }
        if (item.product.photos.every((photo) => importedIds.has(photo.id))) {
          importedProducts += 1;
        }
        failures.push(...result.failures.map((failure) => `${item.product.name}: ${failure.message}`));
        if (!result.importedIds.length && !result.failures.length) {
          failures.push(`${item.product.name}: no photos were imported.`);
        }
      }

      if (importedPhotoIds.size) {
        const importedBatchNames = batch.flatMap((item) =>
          item.product.photos.filter((photo) => importedPhotoIds.has(photo.id)).map((photo) => photo.name)
        );
        const nextImportedNames = new Set([...importedNames, ...importedBatchNames]);
        setImportedNames(nextImportedNames);
        try {
          window.localStorage.setItem(IMPORTED_PHOTOS_KEY, JSON.stringify([...nextImportedNames]));
        } catch {
          failures.push("Products were saved, but this browser could not remember which photos were imported. Re-importing may create duplicates.");
        }
      }

      setBatch((current) => current.flatMap((item) => {
        const remainingPhotos = item.product.photos.filter((photo) => !importedPhotoIds.has(photo.id));
        return remainingPhotos.length
          ? [{ ...item, product: { ...item.product, photos: remainingPhotos } }]
          : [];
      }));
      setSelectedBatchIds(new Set());
      if (importedProducts) {
        setNotice(`${importedProducts} product${importedProducts === 1 ? "" : "s"} saved.`);
      }
      if (failures.length) setError(failures.slice(0, 5).join(" "));
    } catch (importError) {
      setError(importError.message || "Could not import this batch.");
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
              Automatically group likely photos of the same item, apply shared product details, then import the whole collection.
              Visual analysis runs in your browser; your photos are not uploaded to an AI service.
              New groups get editable names such as “Outfit 001”.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving || analyzing} className="rounded-full bg-paper px-4 py-2 text-sm font-bold disabled:opacity-50">Close</button>
        </div>

        <form onSubmit={stageProduct} className="mt-5">
          <p className="mb-3 text-xs leading-5 text-ink/60">
            Set audience, clothing group, sizes, price, and stock once. Automatic groups use these details; edit any generated name in the batch.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-bold">
              Manual product name
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
              <button
                type="button"
                onClick={analyzePhotoLibrary}
                disabled={loading || saving || analyzing}
                className="rounded-full bg-purple-deep px-3 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-50"
              >
                {analyzing ? `${analysisStatus} ${analysisProgress}/${analysisTotal}` : "Auto-group similar photos"}
              </button>
              <button type="button" onClick={selectVisible} disabled={analyzing} className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold disabled:opacity-50">Select visible</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} disabled={analyzing} className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold disabled:opacity-50">Clear selection</button>
            </div>
          </div>

          {analysis && (
            <section aria-label="Suggested photo groups" className="mt-4 rounded-2xl border border-purple-mid/40 bg-white p-3">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold">Similarity suggestions</h3>
                  <p className="mt-1 text-xs text-ink/60">
                    {analysis.photos.length + analysis.failures.length} photos · {suggestedPhotoGroups.length} products · {similarGroupCount} multi-photo groups
                    {analysis.failures.length ? ` · ${analysis.failures.length} analyzed as single-photo products` : ""}
                  </p>
                </div>
                <label className="min-w-52 text-xs font-bold">
                  Match strictness: {similarityThreshold.toFixed(2)}
                  <input
                    type="range"
                    min="0.70"
                    max="0.99"
                    step="0.01"
                    value={similarityThreshold}
                    onChange={(event) => setSimilarityThreshold(Number(event.target.value))}
                    className="mt-1 block w-full"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink/60">
                Higher strictness groups only very similar photos. Check the suggestions: different outfits can still look alike.
              </p>
              {similarGroupCount > 0 && (
                <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {suggestedPhotoGroups.filter((group) => group.length > 1).map((group) => (
                    <div key={group[0].id} className="flex items-center gap-2 rounded-xl bg-purple-soft p-2">
                      <div className="flex shrink-0 -space-x-3">
                        {group.slice(0, 4).map((photo) => (
                          <img key={photo.id} src={photo.url} alt="" className="h-12 w-9 rounded border-2 border-purple-tint object-cover" />
                        ))}
                      </div>
                      <span className="text-xs font-bold">{group.length} similar photos</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setAnalysis(null)} className="rounded-full border border-ink/15 px-4 py-2 text-xs font-bold">
                  Discard suggestions
                </button>
                <button type="button" onClick={addSuggestedGroupsToBatch} className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">
                  Add {suggestedPhotoGroups.length} suggested products to batch
                </button>
              </div>
            </section>
          )}

          {batch.length > 0 && (
            <section aria-label="Products ready to save" className="mt-4 rounded-2xl border border-purple-mid/40 bg-white p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Batch queue · {batch.length} product{batch.length === 1 ? "" : "s"}</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={mergeSelectedGroups}
                    disabled={saving || selectedBatchIds.size < 2}
                    className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    Merge selected groups
                  </button>
                  <button
                    type="button"
                    onClick={applyDefaultsToBatch}
                    disabled={saving}
                    className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    Apply current details to all
                  </button>
                </div>
              </div>
              <div className="grid max-h-[45vh] gap-2 overflow-y-auto sm:grid-cols-2">
                {batch.map((item) => (
                  <article key={item.id} className="min-w-0 rounded-xl bg-purple-soft p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.has(item.id)}
                        onChange={() => toggleBatchSelection(item.id)}
                        disabled={saving}
                        aria-label={`Select ${item.product.name} group for merging`}
                      />
                      <input
                        value={item.product.name}
                        onChange={(event) => setBatch((current) => current.map((queued) => (
                          queued.id === item.id
                            ? { ...queued, product: { ...queued.product, name: event.target.value } }
                            : queued
                        )))}
                        maxLength={100}
                        aria-label={`Product name for ${item.product.name}`}
                        className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-sm font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBatch((current) => current.filter((queued) => queued.id !== item.id));
                          setSelectedBatchIds((current) => {
                            const next = new Set(current);
                            next.delete(item.id);
                            return next;
                          });
                        }}
                        disabled={saving}
                        aria-label={`Remove ${item.product.name} from batch`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm font-bold disabled:opacity-50"
                      >
                        ×
                      </button>
                    </div>
                    <p className="mt-1 truncate pl-6 text-xs text-ink/60">
                      {item.product.category} · {item.product.productGroup} · {item.product.photos.length} photo{item.product.photos.length === 1 ? "" : "s"} · {item.product.sizes.join(", ")} · KSh {item.product.price.toLocaleString()}
                    </p>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {item.product.photos.map((photo) => (
                        <div key={photo.id} className="relative shrink-0">
                          <img src={photo.url} alt="" loading="lazy" className="h-16 w-12 rounded-lg object-cover" />
                          {item.product.photos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => splitPhotoFromGroup(item.id, photo)}
                              disabled={saving}
                              aria-label={`Make ${photo.name} its own product`}
                              title="Split into its own product"
                              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-xs font-bold text-white disabled:opacity-50"
                            >
                              −
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {selectedPhotosInOrder.length > 0 && (
            <div className="mt-4 rounded-2xl border border-purple-mid/40 bg-white p-3">
              <p className="mb-2 text-xs font-bold text-ink/60">Selected for this product · in gallery order</p>
              <div className="flex flex-wrap gap-2">
                {selectedPhotosInOrder.map((photo, index) => (
                  <div key={photo.id} className="flex max-w-full items-center gap-2 rounded-xl bg-purple-soft p-1.5 pr-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-deep text-xs font-bold text-white">{index + 1}</span>
                    <img src={photo.url} alt="" className="h-10 w-8 shrink-0 rounded object-cover" />
                    <span className="max-w-40 truncate text-xs font-medium">{photo.name}</span>
                    <button
                      type="button"
                      onClick={() => togglePhoto(photo.id)}
                      aria-label={`Remove ${photo.name} from selection`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-ink">{notice}</p>}

          {loading ? (
            <p className="py-12 text-center text-sm text-ink/60">Loading photos…</p>
          ) : (
            <div className="mt-4 grid max-h-[50vh] gap-3 overflow-y-auto rounded-2xl border border-purple-mid/40 bg-white p-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {visiblePhotos.map((photo) => (
                <div key={photo.id} className={`overflow-hidden rounded-xl border-2 ${selectedIds.has(photo.id) ? "border-purple-vivid bg-purple-soft" : batchedPhotoIds.has(photo.id) ? "border-purple-mid/50 bg-purple-soft" : "border-transparent bg-paper"}`}>
                  <button type="button" onClick={() => setPreviewPhoto(photo)} aria-label={`Preview ${photo.name}`} className="relative block w-full bg-white">
                    <img src={photo.url} alt="" loading="lazy" className={`aspect-[3/4] w-full object-contain ${selectedIds.has(photo.id) || batchedPhotoIds.has(photo.id) ? "opacity-50" : ""}`} />
                    {selectedIds.has(photo.id) && (
                      <span className="absolute left-2 top-2 rounded-full bg-purple-deep px-2.5 py-1 text-xs font-bold text-white shadow">
                        Selected {selectedPhotosInOrder.findIndex((selectedPhoto) => selectedPhoto.id === photo.id) + 1}
                      </span>
                    )}
                    {batchedPhotoIds.has(photo.id) && (
                      <span className="absolute left-2 top-2 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white shadow">
                        In batch
                      </span>
                    )}
                  </button>
                  <label className="flex cursor-pointer items-start gap-2 p-2 text-xs">
                    <input type="checkbox" checked={selectedIds.has(photo.id)} onChange={() => togglePhoto(photo.id)} disabled={analyzing || batchedPhotoIds.has(photo.id) || (!selectedIds.has(photo.id) && selectedIds.size >= MAX_PHOTOS_PER_PRODUCT)} className="mt-0.5" />
                    <span className="line-clamp-2 break-all">{batchedPhotoIds.has(photo.id) ? "In batch · " : importedNames.has(photo.name) ? "Previously added · " : ""}{photo.name}</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-ink/55">
              Review groups before saving: merge groups for the same item, or split a photo into its own product. Photos cannot be added twice.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving || analyzing || loading || !selectedIds.size || !name.trim() || !sizes.trim()} className="rounded-full border border-ink/15 px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
                Add product to batch
              </button>
              <button type="button" onClick={saveBatch} disabled={saving || !batch.length} className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saving
                  ? `Saving ${progress}/${progressTotal} photos…`
                  : batch.length
                    ? `Save ${batch.length} product${batch.length === 1 ? "" : "s"}`
                    : "Save batch"}
              </button>
            </div>
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
