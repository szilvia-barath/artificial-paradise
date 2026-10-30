#!/usr/bin/env bash
# Short web loops of the artist's videos for the screens in 3D (public/video), with the
# videos' own sound where they have one (the 3D view plays it from the screen's place).
# The full videos stay on Google Drive and play in the artwork viewer.
#   scripts/make_videos.sh <folder with the downloaded Drive videos>
set -euo pipefail
SRC=${1:?folder with the Drive videos}
OUT=public/video
mkdir -p "$OUT"
enc() { # file, output name, start s, duration s, filter, fps, crf, [sound gain dB]
  local audio=(-an)
  # Sound: the gain evens out the very quiet field recordings a little (the limiter
  # keeps peaks below -2 dBFS), short fades hide the seam where the loop restarts.
  if [ -n "${8:-}" ]; then
    audio=(-af "volume=$8dB,alimiter=limit=0.79:level=false,afade=t=in:d=0.6,afade=t=out:st=$(echo "$4 - 0.8" | bc):d=0.8"
      -c:a aac -b:a 96k -ar 48000 -ac 2)
  fi
  ffmpeg -v error -y -ss "$3" -t "$4" -i "$SRC/$1" "${audio[@]}" -vf "$5,fps=$6,format=yuv420p" \
    -c:v libx264 -profile:v high -preset slow -crf "$7" -movflags +faststart "$OUT/$2.mp4"
}
# with sound: Singapore and The Eden Project as they are (about -24 and -26 LUFS), the
# quiet Natural life and Siluett (about -47 and -46 LUFS) raised by 15 dB
enc "artifical paradise_singapore.mp4" w06-artificial-paradise-i 30 40 "scale=960:540" 30 30 -2
enc "artifical paradise_The Eden Project_sound.mp4" w07-artificial-paradise-ii 0 58 "scale=960:540" 30 30 0
# silent: the Wiena files have no sound track, Paradise Factory and Let it flow a silent one
# the cyan Wiena hangs in Room 3 (#8), the red one in Room 4 (#15); the TVs stretched 4:3 to 16:9
enc "Wiena Wrong Landscape NFT 2023.mp4" w08-wiena-wrong-landscape-ii 0 37.6 "scale=960:720" 25 30
enc "Wiena Wrong Landscape NFT - 2 2023.mp4" w15-wiena-wrong-landscape-i 0 37.6 "scale=960:720" 25 30
enc "Natural life, Full Hd, video, 2024 .mp4" w17-natural-life 30 40 "scale=960:540" 25 30 15
# the Paradise Factory monitor stands on its side: turn the footage clockwise
enc "paradise factory_.mp4" w03-screen 20 45 "transpose=1,scale=512:640" 25 30
enc "Siluett.mp4" w16-projection 20 40 "scale=1280:720" 25 32 15
enc "Let it flow_ok.mp4" w16-floor 10 40 "scale=960:540" 25 30
