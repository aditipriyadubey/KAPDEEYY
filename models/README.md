# Model files

`checkpoint_best_total.pth` (134 MB, git-ignored) is the repacked RF-DETR Seg Small
checkpoint from Phase 3A. It is loaded by the local AI worker as:

```python
RFDETRSegSmall(
    pretrain_weights="models/checkpoint_best_total.pth",
    num_classes=18,
)
```

Verified with `rfdetr==1.12.1` on Python 3.13 (`backend/.venv-ai`), CPU-only Torch
2.9.1. Loading and a sample `predict()` call both succeed. Do not download or repack
new weights.

Class names (class-id order, read from the checkpoint):

```text
0 Blazer       1 Dress       2 Halfsleeve  3 Hat
4 Hoodie       5 Jacket      6 Jeans       7 Longsleeve
8 Others       9 Pants      10 Shirt      11 Shorts
12 Skirt      13 Sleeveless 14 Sweater    15 T-shirt
16 Top        17 Trousers
```

The category/subcategory mapping used by the API is in
`backend/app/services/ai/mappings.py`; unknown classes map to `Other`.
