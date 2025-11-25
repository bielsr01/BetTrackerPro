import { ImageUpload } from '../image-upload';

export default function ImageUploadExample() {
  const handleImageUpload = (file: File) => {
    console.log('Image uploaded:', file.name);
  };

  const handleImageRemove = () => {
    console.log('Image removed');
  };

  return (
    <div className="max-w-2xl p-4">
      <ImageUpload 
        onImageUpload={handleImageUpload}
        onImageRemove={handleImageRemove}
        isProcessing={false}
      />
    </div>
  );
}