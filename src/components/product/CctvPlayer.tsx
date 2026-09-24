'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {CctvRecord} from '@/types/domain';
import {Icon} from './Icon';

let stopActivePlayer: (() => void) | null = null;

export function CctvPlayer({item, detail = false}: {item: CctvRecord; detail?: boolean}) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const destroyRef = useRef<() => void>(() => undefined);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const stop = useCallback(() => {
    destroyRef.current();
    destroyRef.current = () => undefined;
    videoRef.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onVisibility);
    const element = containerRef.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = element ? new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < .3) timer = setTimeout(stop, 3_000);
      else if (timer) clearTimeout(timer);
    }, {threshold: [.3]}) : null;
    if (element) observer?.observe(element);
    return () => { document.removeEventListener('visibilitychange', onVisibility); observer?.disconnect(); if (timer) clearTimeout(timer); };
  }, [stop]);

  async function play() {
    if (item.playbackMode === 'external' || !item.hlsUrl) return;
    stopActivePlayer?.();
    stopActivePlayer = stop;
    const video = videoRef.current;
    if (!video) return;
    setPlaying(true); setSlow(false); setFailed(false);
    const slowTimer = setTimeout(() => setSlow(true), 3_000);
    const ready = () => { clearTimeout(slowTimer); setSlow(false); };
    video.addEventListener('playing', ready, {once: true});
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = item.hlsUrl;
      destroyRef.current = () => { video.removeAttribute('src'); video.load(); };
    } else {
      const {default: Hls} = await import('hls.js');
      if (!Hls.isSupported()) { setFailed(true); setPlaying(false); return; }
      const hls = new Hls({lowLatencyMode: true, maxBufferLength: 10, liveSyncDurationCount: 3});
      let retries = 0;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retries < 2) { retries += 1; hls.startLoad(); return; }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retries < 2) { retries += 1; hls.recoverMediaError(); return; }
        setFailed(true); stop();
      });
      hls.loadSource(item.hlsUrl); hls.attachMedia(video);
      destroyRef.current = () => hls.destroy();
    }
    try { await video.play(); } catch { setFailed(true); stop(); }
  }

  return <article ref={containerRef} className={`cctv-card cctv-player ${detail ? 'cctv-player-detail' : ''}`}>
    {playing && <video ref={videoRef} muted playsInline controls aria-label={t(item.nameKey as never)}/>}
    {!playing && <div className="cctv-scene" role="img" aria-label={t('cctv.preview', {place: t(item.nameKey as never)})}><span className="island"/><span className="shore"/></div>}
    <div className={`live-badge status-${item.status}`}><i aria-hidden="true"/><strong>{t(`cctv.status.${item.status}` as never)}</strong><span>{t(item.nameKey as never)}</span></div>
    {item.playbackMode === 'hls' ? <button type="button" className="cctv-play" onClick={playing ? stop : play} aria-label={t(playing ? 'cctv.stop' : 'cctv.play')}><Icon name={playing ? 'close' : 'play'} size={30}/></button>
      : <a className="cctv-external" href={item.providerPageUrl} target="_blank" rel="noreferrer">{t('cctv.openProvider')} <Icon name="chevron" size={17}/></a>}
    {slow && <div className="cctv-notice" role="status">{t('cctv.slow')}</div>}{failed && <div className="cctv-notice" role="alert">{t('cctv.failed')}</div>}
    <small className="cctv-attribution">{t(item.attributionKey as never)}</small>
  </article>;
}
