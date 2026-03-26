'use client'

import { useRef, useState, useEffect } from 'react'

export function HomeHero() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3
    }
  }, [])

  function toggleAudio() {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play()
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden bg-charcoal">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      >
        <source src="/video/intro.mp4" type="video/mp4" />
        <track kind="descriptions" label="Church interior video" />
      </video>

      {/* Brightness overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-black/20"
        aria-hidden="true"
      />

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
        {/* Ornate border with cross decoration */}
        <div className="animate-fade-in-delay relative border-b border-l border-r border-[#F2FDFF] px-6 pb-10 pt-16 opacity-0 sm:px-10">
          {/* Top border with cross */}
          <div className="absolute left-0 right-0 top-0 h-px" aria-hidden="true">
            {/* Left line */}
            <div className="absolute left-0 top-0 h-px w-[calc(50%-60px)] bg-[#F2FDFF]" />
            {/* Cross */}
            <div className="absolute left-1/2 top-[-20px] h-[60px] w-10 -translate-x-1/2">
              {/* Vertical */}
              <div className="absolute left-1/2 top-0 h-[60px] w-px -translate-x-1/2 bg-[#F2FDFF]" />
              {/* Horizontal */}
              <div className="absolute left-0 top-5 h-px w-10 bg-[#F2FDFF]" />
            </div>
            {/* Right line */}
            <div className="absolute right-0 top-0 h-px w-[calc(50%-60px)] bg-[#F2FDFF]" />
          </div>

          {/* Church name */}
          <div className="min-h-[35px] text-center">
            <h2 className="animate-drop-in inline-block font-body text-lg font-bold text-cream-50 sm:text-xl md:text-[1.875rem]">
              St. Basil&#39;s Syriac Orthodox Church
            </h2>
          </div>

          {/* Typewriter heading */}
          <div className="mt-2 min-h-[40px] text-center sm:min-h-[55px] md:min-h-[75px] lg:min-h-[90px]">
            <h1 className="typewriter-text font-heading text-[2.25rem] font-bold text-cream-50 sm:text-[3.125rem] md:text-[4.375rem] lg:text-[5.5rem]">
              Come As You Are
            </h1>
          </div>

          {/* Psalm quote */}
          <div className="mt-5 min-h-[25px] text-center">
            <p className="animate-fade-in-delay inline-block font-body text-sm italic text-cream-50 opacity-0 sm:text-base md:text-xl">
              &ldquo;Taste and see that the Lord is good; blessed is the one who
              takes refuge in him.&rdquo; — Psalms 34:8
            </p>
          </div>
        </div>
      </div>

      {/* Audio player */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Background prayer audio, no captions available */}
      <audio ref={audioRef} loop preload="none">
        <source src="/audio/our-father.mp3" type="audio/mpeg" />
      </audio>

      {/* Audio toggle button */}
      <button
        onClick={toggleAudio}
        aria-label={isPlaying ? 'Mute audio' : 'Play audio'}
        className="absolute bottom-8 left-8 z-20 flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-full border border-[#F2FDFF] bg-black/50 transition-all duration-300 hover:scale-110 hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50"
      >
        {isPlaying ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F2FDFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F2FDFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>

      {/* Scroll chevron */}
      <div
        className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce motion-reduce:animate-none"
        aria-hidden="true"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cream-50/60"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </section>
  )
}
