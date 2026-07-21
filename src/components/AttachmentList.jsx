import { useEffect, useState } from 'react';
import { Download, File, Image, Music2, Trash2 } from 'lucide-react';
import { bytesLabel } from '../lib/noteUtils.js';
import { deleteMedia, getMedia } from '../lib/mediaDb.js';
import { downloadBlob } from '../lib/exporters.js';

function AttachmentItem({ attachment, onRemove }) {
  const [url, setUrl] = useState('');
  const [blob, setBlob] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    getMedia(attachment.id).then((record) => {
      if (!active || !record?.blob) return;
      setBlob(record.blob);
      objectUrl = URL.createObjectURL(record.blob);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  const KindIcon = attachment.kind === 'image' ? Image : attachment.kind === 'audio' ? Music2 : File;

  async function remove() {
    await deleteMedia(attachment.id).catch(() => {});
    onRemove(attachment.id);
  }

  return (
    <li className="attachment-item">
      {attachment.kind === 'image' && url ? <img src={url} alt={attachment.name} loading="lazy" /> : <span className="attachment-icon"><KindIcon /></span>}
      <div className="attachment-meta"><strong dir="auto">{attachment.name}</strong><span>{bytesLabel(attachment.size)}</span></div>
      {attachment.kind === 'audio' && url && <audio src={url} controls preload="metadata" />}
      <button type="button" className="icon-only" aria-label={`تنزيل ${attachment.name}`} disabled={!blob} onClick={() => blob && downloadBlob(blob, attachment.name)}><Download /></button>
      <button type="button" className="icon-only danger" aria-label={`حذف ${attachment.name}`} onClick={remove}><Trash2 /></button>
    </li>
  );
}

export default function AttachmentList({ attachments, onRemove }) {
  if (!attachments?.length) return null;
  return (
    <section className="attachments-section" aria-labelledby="attachments-title">
      <h3 id="attachments-title">المرفقات <span>{attachments.length}</span></h3>
      <ul>{attachments.map((attachment) => <AttachmentItem key={attachment.id} attachment={attachment} onRemove={onRemove} />)}</ul>
    </section>
  );
}
