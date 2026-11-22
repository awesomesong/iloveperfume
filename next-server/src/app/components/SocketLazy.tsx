'use client';
import dynamic from 'next/dynamic';

const SocketState = dynamic(
  () => import('@/src/app/components/SocketState'),
  { ssr: false }
);
const UserActiveStatus = dynamic(
  () => import('@/src/app/components/ActiveStatus'),
  { ssr: false }
);

export default function SocketLazy() {
  return (
    <>
      <SocketState />
      <UserActiveStatus />
    </>
  );
}
