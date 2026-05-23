import cv2
from app.core.config import get_settings
from app.services.ocr.pan import extract_pan_fields

img_path = '/Users/anandkamble/Downloads/AnandPAN.jpeg'
img = cv2.imread(img_path)
from app.services.preprocessing import preprocess_document
img, _ = preprocess_document(img)

settings = get_settings()
fields, conf, text = extract_pan_fields(img, settings)
print('FULL RAW TEXT:\n---')
print(text)
print('---\nFIELDS:', fields)
