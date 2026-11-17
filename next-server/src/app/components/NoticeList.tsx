'use client';
import Link from 'next/link';

const NoticeList = () => {
    return (
        <Link
            href="/news"
            className="action-btn"
        >
            목록
        </Link>
    );
};

export default NoticeList;
