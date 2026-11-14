import type { LegalBlock, LegalDoc } from '@/src/app/config/legal';

function Block({ block }: { block: LegalBlock }) {
    if (block.type === 'p') {
        return <p>{block.text}</p>;
    }
    if (block.type === 'list') {
        return (
            <ul className="legal-list">
                {block.items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        );
    }
    return (
        <div className="legal-table-wrap">
            <table className="legal-table">
                <thead>
                    <tr>
                        {block.head.map((cell) => (
                            <th key={cell} scope="col">{cell}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {block.rows.map((row) => (
                        <tr key={row[0]}>
                            {row.map((cell, i) =>
                                i === 0 ? (
                                    <th key={cell} scope="row">{cell}</th>
                                ) : (
                                    <td key={cell}>{cell}</td>
                                ),
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** 이용약관·개인정보처리방침 공용 본문 — 내용은 config/legal.ts 에서 관리 */
export default function LegalDocument({ doc }: { doc: LegalDoc }) {
    return (
        <article className="legal-doc">
            <h2 className="text-gradient-ilp page-title-gradient">{doc.title}</h2>
            <p className="legal-intro">{doc.intro}</p>
            {doc.sections.map((section) => (
                <section key={section.title} className="legal-section">
                    <h3>{section.title}</h3>
                    {section.blocks.map((block, i) => (
                        <Block key={i} block={block} />
                    ))}
                </section>
            ))}
        </article>
    );
}
