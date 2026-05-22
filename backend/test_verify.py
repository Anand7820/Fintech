import asyncio
from app.services.verification_pipeline import verify_document

async def main():
    try:
        with open("test_image.jpg", "rb") as f:
            content = f.read()
        res = await verify_document(content, "image/jpeg", "test_image.jpg")
        print(res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
