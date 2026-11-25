# API contracts (implemented so far)
Base URL: `http://localhost:8000/api`. All endpoints except /health need `Authorization: Bearer <supabase access token>`.

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | /health | no | – | `{status, supabase_configured}` |
| GET | /ai/status | yes | – | checkpoint, worker, RF-DETR, CUDA and Gemini readiness (booleans only) |
| GET | /profile | yes | – | `{id, full_name, email, created_at, updated_at}` |
| PUT | /profile | yes | `{full_name}` (1–100 chars; unknown fields → 422) | updated profile |
| GET | /wardrobe | yes | – | `WardrobeItem[]`, newest first, each with a signed `image_url` |
| POST | /wardrobe/upload | yes | `multipart/form-data` field `file` (JPEG/PNG/WebP, ≤10 MB) | `201 {bucket, path, image_url}` |
| DELETE | /wardrobe/upload?path= | yes | – | `{ok:true}`; removes one of the caller's uploaded files (rollback) |
| POST | /wardrobe | yes | metadata JSON plus optional `original_image_path` from the upload response | `201 WardrobeItem` |
| PATCH | /wardrobe/{id} | yes | any editable metadata field | updated `WardrobeItem` |
| DELETE | /wardrobe/{id} | yes | – | `{ok:true, removed_images}` |
| POST | /wardrobe/{id}/analyze | yes | – | cutout stored, segmentation updated, AI suggestions returned |

Wardrobe item (stored columns): `item_name`, `category`, `subcategory`, `colour`, `colour_hex`,
`pattern`, `style`, `suggested_occasions[]`, `season`, `original_image_path`,
`segmented_image_path`, `segmentation_status` (`pending` in Phase 2), plus
`id`, `user_id`, `created_at`, `updated_at` and the computed `image_url`.

## Wardrobe storage rules
- Original images go to the private `wardrobe-original` bucket under `<verified user id>/<uuid>.<ext>`.
  The folder always comes from the bearer token; RLS independently rejects other folders.
- Listing signs the segmented image when present, otherwise the original. Signed URLs are
  temporary (1 hour) and are never stored in the database.
- Deleting an item removes its original and segmented objects first, then the database row.
  If Storage cleanup fails the row is kept and the API returns 502, so files are not orphaned
  and success is not reported. Outfit cascade still happens in Postgres when the row is deleted.

Errors: 401 missing/invalid token, 403 Storage/RLS denial, 404 unknown or another user's item,
409 unsafe stored image path, 413 image over 10 MB, 415 unsupported image, 422 validation,
503 Supabase unreachable/not configured, 502 database or storage error.

## Garment analysis (Phase 3B)

`POST /wardrobe/{id}/analyze` verifies ownership of `{id}`, downloads the original from the
private `wardrobe-original` bucket with the caller's JWT, and calls the local AI worker. The
worker runs RF-DETR once-loaded inference and classifies the transparent cutout with Gemini.
The backend uploads the PNG to `wardrobe-segmented/<user id>/<uuid>.png` and updates only
`segmented_image_path` and `segmentation_status='completed'`. User-entered metadata is never
automatically overwritten.

```json
{
  "item": { "id": "...", "segmentation_status": "completed", "image_url": "..." },
  "suggestions": {
    "item_name": "Ivory Knit Top",
    "category": "Tops",
    "subcategory": "Top",
    "colour": "Ivory",
    "style": "Street",
    "condition": "good",
    "condition_note": "No visible damage."
  },
  "detection": { "label": "Top", "confidence": 0.91 },
  "classification_source": "Online (Gemini)",
  "privacy_notice": "... Google Gemini ..."
}
```

- Category/subcategory come from the RF-DETR label; unknown/`Others` labels fall back to
  `Other` (or the Gemini category when the detector reports `Others`).
- `colour` is Gemini's `primary_color`; `style` is mapped to an existing frontend value
  (`Casual`, `Smart`, `Street`, ...). `pattern`, `season`, `suggested_occasions` are not invented.
- `condition` / `condition_note` are suggestions only — the database has no such columns and
  Phase 3B adds no migrations.
- On segmentation or Gemini failure the original image and all metadata are preserved and
  `segmentation_status` becomes `failed`. If the database update fails after upload, the new
  segmented object is deleted before the error is returned. Re-analysis uses a new unique path
  and removes the replaced cutout only after the row update succeeds.
- The Gemini key lives only in the AI worker environment. The browser receives a privacy notice;
  no API key or worker token is ever returned.

`GET /ai/status` returns `status` (`ok`, `degraded`, `unavailable`), `checkpoint_available`,
`worker_available`, `rfdetr_ready`, `model_loaded`, `cuda_available` and `gemini_configured`.
It reads the worker's cached model state and never loads the model for the probe.
