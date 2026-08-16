export function AudioPlayer({ src }: { src: string }) {
  return (
    <audio controls src={src} className="w-full">
      Your browser does not support the audio element.
    </audio>
  );
}
