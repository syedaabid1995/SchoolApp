'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export const useApiError = (error: unknown) => {
  const router = useRouter();

  useEffect(() => {
    if (!error) return;

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) {
        router.replace('/login');
        return;
      }
      if (error.response?.data?.message) {
        window.alert(error.response.data.message);
        return;
      }
    }

    if (error instanceof Error) {
      window.alert(error.message);
    }
  }, [error, router]);
};
