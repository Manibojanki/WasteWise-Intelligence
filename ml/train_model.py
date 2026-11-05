
from pathlib import Path
from collections import Counter
import json
import tensorflow as tf

from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras import layers, models
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

# --------------------------------------------------
# 1. Configuration
# --------------------------------------------------

TRAIN_DIR = Path("dataset_split/train")
VAL_DIR = Path("dataset_split/validation")
MODEL_DIR = Path("models")

MODEL_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 8
EPOCHS = 5
SEED = 42

tf.keras.utils.set_random_seed(SEED)

# --------------------------------------------------
# 2. Load training and validation images
# --------------------------------------------------

train_ds = tf.keras.utils.image_dataset_from_directory(
    TRAIN_DIR,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="int",
    shuffle=True,
    seed=SEED
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    VAL_DIR,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="int",
    shuffle=False
)

class_names = train_ds.class_names
print("\nClass names:", class_names)

# --------------------------------------------------
# 3. Calculate class weights
# --------------------------------------------------

class_counts = Counter()

for category in class_names:
    class_counts[category] = len(
        list((TRAIN_DIR / category).glob("*.jpg"))
    )

total_images = sum(class_counts.values())
number_of_classes = len(class_names)

class_weights = {
    index: total_images / (number_of_classes * class_counts[name])
    for index, name in enumerate(class_names)
}

print("\nTraining class counts:", dict(class_counts))
print("Class weights:", class_weights)

# --------------------------------------------------
# 4. Preprocess datasets
# --------------------------------------------------

def prepare_images(images, labels):
    images = preprocess_input(images)
    return images, labels

train_ds = train_ds.map(
    prepare_images,
    num_parallel_calls=1
).prefetch(1)

val_ds = val_ds.map(
    prepare_images,
    num_parallel_calls=1
).prefetch(1)

# --------------------------------------------------
# 5. Load pretrained MobileNetV2
# --------------------------------------------------

base_model = MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights="imagenet"
)

# Freeze the pretrained layers initially
base_model.trainable = False

# --------------------------------------------------
# 6. Build the six-class model
# --------------------------------------------------

inputs = layers.Input(shape=(224, 224, 3))

# Data augmentation is active during training only
x = layers.RandomFlip("horizontal")(inputs)
x = layers.RandomRotation(0.05)(x)

x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.3)(x)

outputs = layers.Dense(
    number_of_classes,
    activation="softmax"
)(x)

model = models.Model(inputs, outputs)

# --------------------------------------------------
# 7. Compile model
# --------------------------------------------------

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

model.summary()

# --------------------------------------------------
# 8. Training callbacks
# --------------------------------------------------

model_path = MODEL_DIR / "wastewise_mobilenetv2_head.keras"

callbacks = [
    EarlyStopping(
        monitor="val_loss",
        patience=2,
        restore_best_weights=True
    ),
    ModelCheckpoint(
        filepath=model_path,
        monitor="val_loss",
        save_best_only=True
    )
]

# --------------------------------------------------
# 9. Train the classification head
# --------------------------------------------------

print("\nStarting MobileNetV2 training...")

history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    class_weight=class_weights,
    callbacks=callbacks
)

# --------------------------------------------------
# 10. Save class mapping and training details
# --------------------------------------------------

configuration = {
    "model_name": "MobileNetV2",
    "model_version": "1.0.0",
    "image_size": [224, 224],
    "class_names": class_names,
    "class_to_index": {
        name: index for index, name in enumerate(class_names)
    },
    "preprocessing": "MobileNetV2 preprocess_input",
    "batch_size": BATCH_SIZE,
    "epochs_requested": EPOCHS,
    "random_seed": SEED,
    "training_class_counts": dict(class_counts)
}

config_path = MODEL_DIR / "model_config.json"

with open(config_path, "w", encoding="utf-8") as file:
    json.dump(configuration, file, indent=4)

print("\nTraining completed!")
print("Model saved to:", model_path)
print("Configuration saved to:", config_path)
