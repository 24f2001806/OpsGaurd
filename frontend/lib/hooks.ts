'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from './api';

// Runs `callback` now and then again every `ms` milliseconds,
// so the pages show new results from the worker without a manual refresh.
export function usePolling(callback: () => void | Promise<void>, ms: number) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  });
  useEffect(() => {
    saved.current();
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// Sends the visitor to the login page when there is no login token.
export function useRequireLogin() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.replace('/');
  }, [router]);
}
