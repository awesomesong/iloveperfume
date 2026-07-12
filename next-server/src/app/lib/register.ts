import { apiFetch } from "@/src/app/utils/apiFetch";

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

export const registerUser = async (data: RegisterRequest): Promise<RegisterResponse> => {
  return apiFetch<RegisterResponse>(`/api/register`, {
    method: 'POST',
    body: JSON.stringify(data),
    defaultErrorMessage: '회원가입 중 오류가 발생했습니다.',
  });
};
