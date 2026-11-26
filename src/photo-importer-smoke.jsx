import React from "react";
import ReactDOM from "react-dom/client";
import PublicPhotoImporter from "./components/PublicPhotoImporter.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <PublicPhotoImporter
    onClose={() => {}}
    onImportBatch={async (products) => ({
      results: products.map((product) => ({
        importedIds: product.photos.map((photo) => photo.id),
        failures: [],
      })),
    })}
  />
);
