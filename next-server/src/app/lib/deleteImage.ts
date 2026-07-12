import { apiFetch } from "@/src/app/utils/apiFetch";

type DeleteImageResponse = {
  data: { result: string };
};

export const deleteImage = async (url: string): Promise<boolean> => {
  const { data } = await apiFetch<DeleteImageResponse>('/api/cloudinary', {
    method: 'DELETE',
    body: JSON.stringify({ url }),
    defaultErrorMessage: "이미지 삭제 중 오류가 발생했습니다.",
  });

  return data.result === 'ok';
};
