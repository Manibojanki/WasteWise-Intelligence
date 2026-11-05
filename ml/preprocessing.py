
from PIL import Image
import numpy as np
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

IMAGE_SIZE = (224, 224)


def preprocess_image(image_path):
    """
    Load and preprocess one image for MobileNetV2.
    Returns an array with shape (1, 224, 224, 3).
    """

    with Image.open(image_path) as image:
        image = image.convert("RGB")
        image = image.resize(IMAGE_SIZE)

        image_array = np.asarray(image, dtype=np.float32)

    image_array = preprocess_input(image_array)

    return np.expand_dims(image_array, axis=0)


def preprocess_image_batch(image_paths):
    """
    Load and preprocess multiple images.
    """

    images = []

    for image_path in image_paths:
        with Image.open(image_path) as image:
            image = image.convert("RGB")
            image = image.resize(IMAGE_SIZE)

            image_array = np.asarray(image, dtype=np.float32)
            images.append(image_array)

    batch = np.asarray(images, dtype=np.float32)

    return preprocess_input(batch)

