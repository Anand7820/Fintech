import cv2
import numpy as np
import pytesseract
from app.core.config import get_settings
from app.services.ocr.pan import _crop_pan_regions, _enhance_region, _ocr_region, _parse_pan_fields

# Check if there is an image uploaded recently. Or let's just find the latest image in the Downloads folder or wherever it might be?
# The user is probably uploading from a local file. We don't have the file path.
# Let's write a FastAPI test client script to send a dummy request if we can't find the image,
# or let's search for pan images in the current directory.
