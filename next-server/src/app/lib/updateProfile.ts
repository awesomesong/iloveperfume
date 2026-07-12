import { apiFetch } from "@/src/app/utils/apiFetch";

export interface UpdateProfileRequest {
  image: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  image: string;
  message?: string;
}

export const updateProfile = async (data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
  return apiFetch<UpdateProfileResponse>(`/api/settings`, {
    method: "POST",
    body: JSON.stringify(data),
    defaultErrorMessage: "프로필 수정 중 오류가 발생했습니다.",
  });
};
