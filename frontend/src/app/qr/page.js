'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QrRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/businesses'); }, [router]);
  return <div className="text-center py-12 text-gray-400">Redirecting to dashboard...</div>;
}
