import { SupabaseClient } from '@supabase/supabase-js';

export async function uploadImageAndGetUrl(supabase: SupabaseClient, base64Image: string, bucketName: string = 'technical-article-images'): Promise<string | null> {
  if (!base64Image) {
    return null;
  }

  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); // 이 줄은 제거

  // Extract image type and data from base64 string
  const matches = base64Image.match(/^data:(.*?);base64,(.*)$/);
  if (!matches || matches.length !== 3) {
    console.error('Invalid base64 image format');
    return null;
  }

  const contentType = matches[1];
  const base64Data = matches[2];

  const imageBuffer = Buffer.from(base64Data, 'base64');
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${contentType.split('/')[1]}`;
  const filePath = `public/${fileName}`;

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, imageBuffer, {
        contentType: contentType,
        upsert: false, // Do not overwrite if file exists
      });

    if (error) {
      console.error('Error uploading image to Supabase Storage:', error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;

  } catch (error) {
    console.error('Unexpected error during image upload:', error);
    return null;
  }
}