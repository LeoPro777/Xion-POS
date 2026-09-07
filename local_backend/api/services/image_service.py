# filepath: local_backend/api/services/image_service.py
import os
import uuid
from PIL import Image, ImageOps
from fastapi import UploadFile, HTTPException

# Resolve path relative to this file to reach local_backend/data/uploads/products
# This file is in local_backend/api/services/image_service.py
# So we go up 3 levels to reach local_backend, then data/uploads/products
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_upload_dir(folder: str = "products") -> str:
    path = os.path.join(BASE_DIR, "data", "uploads", folder)
    os.makedirs(path, exist_ok=True)
    return path

VALID_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}

def save_and_process_image(file: UploadFile, old_image_id: str | None = None, folder: str = "products") -> str:
    # 1. Validar Tipo MIME
    if file.content_type not in VALID_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagen inválido. Use JPG, PNG o WebP.")

    # 2. Generar Identificador Único
    new_image_id = uuid.uuid4().hex[:12]
    upload_dir = get_upload_dir(folder)
    thumb_path = os.path.join(upload_dir, f"thumb_{new_image_id}.webp")
    medium_path = os.path.join(upload_dir, f"medium_{new_image_id}.webp")

    try:
        # 3. Abrir y normalizar imagen
        with Image.open(file.file) as img:
            img = ImageOps.exif_transpose(img)  # Corrige orientación EXIF
            if img.mode in ("RGBA", "P"):
                # Conversión con fondo blanco para transparencias PNG si se requiere RGB
                img = img.convert("RGBA")
                background = Image.new("RGBA", img.size, (255, 255, 255))
                img = Image.alpha_composite(background, img).convert("RGB")
            else:
                img = img.convert("RGB")

            # 4. Generar versión Medium (500x500, 1:1 Centered Fit)
            img_medium = ImageOps.fit(img, (500, 500), method=Image.Resampling.LANCZOS)
            img_medium.save(medium_path, "WEBP", quality=80, optimize=True)

            # 5. Generar versión Thumbnail (150x150, 1:1 Centered Fit)
            img_thumb = ImageOps.fit(img, (150, 150), method=Image.Resampling.LANCZOS)
            img_thumb.save(thumb_path, "WEBP", quality=75, optimize=True)

    except PermissionError:
        raise HTTPException(status_code=500, detail="Error de permisos de escritura en el disco.")
    except Exception as e:
        # Limpieza en caso de fallo durante el procesamiento
        for path in [thumb_path, medium_path]:
            if os.path.exists(path):
                os.remove(path)
        raise HTTPException(status_code=500, detail=f"Error al procesar la imagen: {str(e)}")

    # 6. Eliminar archivos físicos anteriores si existían
    if old_image_id:
        delete_image(old_image_id, folder)

    return new_image_id

def delete_image(image_id: str | None, folder: str = "products") -> None:
    if not image_id:
        return
    upload_dir = get_upload_dir(folder)
    for prefix in ["thumb_", "medium_"]:
        file_path = os.path.join(upload_dir, f"{prefix}{image_id}.webp")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

def save_and_process_product_image(file: UploadFile, old_image_id: str | None = None) -> str:
    return save_and_process_image(file, old_image_id, "products")

def delete_product_images(image_id: str | None) -> None:
    return delete_image(image_id, "products")

def save_and_process_payment_method_image(file: UploadFile, old_image_id: str | None = None) -> str:
    return save_and_process_image(file, old_image_id, "payment_methods")

def delete_payment_method_images(image_id: str | None) -> None:
    return delete_image(image_id, "payment_methods")

