import { apiFetch } from "@/src/app/utils/apiFetch";

type Props = {
  id: string;
};

type AddNoticeViewCountResponse = {
  message: string;
  viewCountIncremented: boolean;
  addedNoticeViewCount: { viewCount: number };
};

export const addNoticeViewCount = async ({ id }: Props) => {
    return apiFetch<AddNoticeViewCountResponse>(`/api/notice/${id}/viewCount`, {
        method: 'POST',
        defaultErrorMessage: "조회수 반영 중 오류가 발생했습니다.",
    });
}