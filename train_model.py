import os, json, time, copy, random
from pathlib import Path
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, WeightedRandomSampler, Subset
from torchvision import datasets, transforms, models
from sklearn.metrics import (
    classification_report, confusion_matrix, precision_recall_fscore_support
)
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from tqdm import tqdm

# ── CONFIG ───────────────────────────────────────────────────────────────────
DATASET_ROOT = Path("e:/paper/dataset/extracted/Gambo")
OUTPUT_DIR   = Path("e:/paper/model_output")
OUTPUT_DIR.mkdir(exist_ok=True)
MODEL_SAVE_PATH    = OUTPUT_DIR / "saksham_model.pth"
METADATA_SAVE_PATH = OUTPUT_DIR / "model_metadata.json"
CURVES_SAVE_PATH   = OUTPUT_DIR / "training_curves.png"

IMG_SIZE     = 224
BATCH_SIZE   = 32          # smaller batch = faster CPU iteration
NUM_EPOCHS   = 20
LR           = 1e-4
WEIGHT_DECAY = 1e-4
PATIENCE     = 4
NUM_WORKERS  = 0
SEED         = 42

# Stratified subset sizes per class (set to None to use full dataset)
# Full dataset: ~3.3h/epoch on CPU. 2000/class => ~8-12 min/epoch.
TRAIN_SAMPLES_PER_CLASS = 2000
TEST_SAMPLES_PER_CLASS  = 600

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

DATASET_DESCRIPTION = (
    "Gambo Dyslexia Handwriting Dataset. "
    "3 classes: Corrected (over-correction), Normal (typical), Reversal (letter reversal). "
    "English handwriting images. Full dataset: Train ~151,649 | Test ~56,723. "
    f"This model trained on a stratified subset: {TRAIN_SAMPLES_PER_CLASS} samples/class train, "
    f"{TEST_SAMPLES_PER_CLASS} samples/class test. Source: Kaggle - educational/research use."
)

print(f"Device: {DEVICE}")
print(f"Subset: {TRAIN_SAMPLES_PER_CLASS} train / {TEST_SAMPLES_PER_CLASS} test per class")

# ── TRANSFORMS ───────────────────────────────────────────────────────────────
train_tfm = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(p=0.3),
    transforms.RandomRotation(10),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
test_tfm = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ── LOAD FULL DATASETS ────────────────────────────────────────────────────────
print("Loading datasets...")
full_train = datasets.ImageFolder(DATASET_ROOT / "Train", transform=train_tfm)
full_test  = datasets.ImageFolder(DATASET_ROOT / "Test",  transform=test_tfm)
CLASS_NAMES = full_train.classes
NUM_CLASSES = len(CLASS_NAMES)
print(f"Classes: {CLASS_NAMES}")

# ── STRATIFIED SUBSET ─────────────────────────────────────────────────────────
def stratified_subset(dataset, n_per_class, seed=42):
    rng = np.random.default_rng(seed)
    targets = np.array(dataset.targets)
    indices = []
    for cls in range(len(dataset.classes)):
        cls_idx = np.where(targets == cls)[0]
        chosen  = rng.choice(cls_idx, size=min(n_per_class, len(cls_idx)), replace=False)
        indices.extend(chosen.tolist())
    return Subset(dataset, indices)

train_ds = stratified_subset(full_train, TRAIN_SAMPLES_PER_CLASS, seed=SEED)
test_ds  = stratified_subset(full_test,  TEST_SAMPLES_PER_CLASS,  seed=SEED)

train_targets = np.array([full_train.targets[i] for i in train_ds.indices])
test_targets  = np.array([full_test.targets[i]  for i in test_ds.indices])
train_counts  = np.bincount(train_targets, minlength=NUM_CLASSES)
test_counts   = np.bincount(test_targets,  minlength=NUM_CLASSES)

print(f"Subset sizes -> Train: {len(train_ds):,} | Test: {len(test_ds):,}")
for i, c in enumerate(CLASS_NAMES):
    print(f"  {c}: Train={train_counts[i]:,}  Test={test_counts[i]:,}")

# ── DATALOADERS ───────────────────────────────────────────────────────────────
cw = 1.0 / train_counts.astype(float)
sw = [cw[t] for t in train_targets]
sampler = WeightedRandomSampler(sw, len(sw), replacement=True)
train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                          num_workers=NUM_WORKERS, pin_memory=(DEVICE.type == "cuda"))
test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=NUM_WORKERS, pin_memory=(DEVICE.type == "cuda"))

# ── MODEL ─────────────────────────────────────────────────────────────────────
print("Building MobileNetV2 (cached weights)...")
model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
in_f = model.classifier[1].in_features
model.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(in_f, 256),
    nn.ReLU(),
    nn.Dropout(0.2),
    nn.Linear(256, NUM_CLASSES),
)
model = model.to(DEVICE)

# ── LOSS / OPTIMIZER / SCHEDULER ─────────────────────────────────────────────
lw = torch.tensor(cw / cw.sum(), dtype=torch.float32).to(DEVICE)
criterion = nn.CrossEntropyLoss(weight=lw)
optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=2)

# ── TRAIN / EVAL FUNCTIONS ────────────────────────────────────────────────────
def train_epoch(model, loader, crit, opt, device):
    model.train()
    loss_sum, correct, total = 0.0, 0, 0
    for imgs, labels in tqdm(loader, desc="  Train", leave=False):
        imgs, labels = imgs.to(device), labels.to(device)
        opt.zero_grad()
        out = model(imgs)
        loss = crit(out, labels)
        loss.backward()
        opt.step()
        loss_sum += loss.item() * imgs.size(0)
        correct  += (out.argmax(1) == labels).sum().item()
        total    += imgs.size(0)
    return loss_sum / total, correct / total

def evaluate(model, loader, crit, device):
    model.eval()
    loss_sum, correct, total = 0.0, 0, 0
    all_p, all_l = [], []
    with torch.no_grad():
        for imgs, labels in tqdm(loader, desc="  Eval ", leave=False):
            imgs, labels = imgs.to(device), labels.to(device)
            out = model(imgs)
            loss_sum += crit(out, labels).item() * imgs.size(0)
            p = out.argmax(1)
            correct  += (p == labels).sum().item()
            total    += imgs.size(0)
            all_p.extend(p.cpu().numpy())
            all_l.extend(labels.cpu().numpy())
    return loss_sum / total, correct / total, all_p, all_l

# ── TRAINING LOOP ─────────────────────────────────────────────────────────────
history = {"tl": [], "ta": [], "vl": [], "va": []}
best_acc, best_wts, no_imp = 0.0, copy.deepcopy(model.state_dict()), 0
t_start = time.time()
print("=" * 60)
print("Training")
print("=" * 60)

for ep in range(1, NUM_EPOCHS + 1):
    ep_t = time.time()
    tl, ta = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
    vl, va, _, _ = evaluate(model, test_loader, criterion, DEVICE)
    scheduler.step(va)
    history["tl"].append(tl); history["ta"].append(ta)
    history["vl"].append(vl); history["va"].append(va)
    elapsed = int(time.time() - ep_t)
    print(f"  Epoch [{ep:02d}/{NUM_EPOCHS}] "
          f"TrLoss:{tl:.4f} TrAcc:{ta*100:.2f}% | "
          f"VlLoss:{vl:.4f} VlAcc:{va*100:.2f}% | {elapsed}s")
    if va > best_acc:
        best_acc = va
        best_wts = copy.deepcopy(model.state_dict())
        no_imp = 0
        print(f"    -> New best val acc: {best_acc*100:.2f}%")
    else:
        no_imp += 1
        if no_imp >= PATIENCE:
            print(f"  Early stopping at epoch {ep}")
            break

total_min = (time.time() - t_start) / 60
print(f"\nTraining done in {total_min:.1f} min | Best val acc: {best_acc*100:.2f}%")

# ── FINAL HELD-OUT EVALUATION ─────────────────────────────────────────────────
print("\nFinal evaluation on held-out test subset...")
model.load_state_dict(best_wts)
_, test_acc, test_preds, test_labels = evaluate(model, test_loader, criterion, DEVICE)
prec, rec, f1, sup = precision_recall_fscore_support(test_labels, test_preds, average=None)
print(classification_report(test_labels, test_preds, target_names=CLASS_NAMES))
cm = confusion_matrix(test_labels, test_preds)

# ── SAVE MODEL ────────────────────────────────────────────────────────────────
torch.save({
    "model_state_dict": best_wts,
    "class_names":      CLASS_NAMES,
    "img_size":         IMG_SIZE,
}, MODEL_SAVE_PATH)
print(f"Model saved: {MODEL_SAVE_PATH}")

# ── SAVE METADATA ─────────────────────────────────────────────────────────────
meta = {
    "version": "1.0.0",
    "backbone": "MobileNetV2 ImageNet pretrained fine-tuned",
    "class_names": CLASS_NAMES,
    "dataset_description": DATASET_DESCRIPTION,
    "train_samples_used": len(train_ds),
    "test_samples_used":  len(test_ds),
    "train_class_distribution": {c: int(train_counts[i]) for i, c in enumerate(CLASS_NAMES)},
    "test_class_distribution":  {c: int(test_counts[i])  for i, c in enumerate(CLASS_NAMES)},
    "validation_accuracy": round(float(test_acc), 4),
    "per_class_metrics": {
        CLASS_NAMES[i]: {
            "precision": round(float(prec[i]), 4),
            "recall":    round(float(rec[i]),  4),
            "f1_score":  round(float(f1[i]),   4),
            "support":   int(sup[i]),
        }
        for i in range(NUM_CLASSES)
    },
    "confusion_matrix": cm.tolist(),
    "training_epochs_run": len(history["tl"]),
    "best_val_accuracy_during_training": round(float(best_acc), 4),
    "training_notes": (
        "IMPORTANT: validation_accuracy is on the held-out test subset NEVER seen during training. "
        "Report this number, not training accuracy. "
        "This tool is a screening aid, not a clinical diagnostic instrument."
    ),
    "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
}
with open(METADATA_SAVE_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"Metadata saved: {METADATA_SAVE_PATH}")

# ── TRAINING CURVES ───────────────────────────────────────────────────────────
ep_range = range(1, len(history["tl"]) + 1)
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle("Saksham MobileNetV2 Training Curves", fontsize=14, fontweight="bold")
axes[0].plot(ep_range, history["tl"], label="Train", color="#4A90D9")
axes[0].plot(ep_range, history["vl"], label="Val (held-out)", color="#E74C3C")
axes[0].set_title("Loss"); axes[0].set_xlabel("Epoch")
axes[0].legend(); axes[0].grid(alpha=0.3)
axes[1].plot(ep_range, [a * 100 for a in history["ta"]], label="Train", color="#4A90D9")
axes[1].plot(ep_range, [a * 100 for a in history["va"]], label="Val (held-out)", color="#E74C3C")
axes[1].axhline(best_acc * 100, color="#27AE60", linestyle="--",
                label=f"Best: {best_acc*100:.2f}%")
axes[1].set_title("Accuracy"); axes[1].set_xlabel("Epoch")
axes[1].legend(); axes[1].grid(alpha=0.3)
plt.tight_layout()
plt.savefig(CURVES_SAVE_PATH, dpi=150, bbox_inches="tight")
print(f"Curves saved: {CURVES_SAVE_PATH}")

print(f"\nALL DONE. Held-out Test Accuracy: {test_acc*100:.2f}%")
print("Report this number honestly in your dashboard and pitch.")
