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
# One cycle of a video whose picture repeats while its sound runs on: the sound's end is
# crossfaded into its start so nothing dips where the loop restarts. For slow, small movement
# (leaves in the wind): no B-frames and no skipped blocks, which freeze it at web bitrates,
# and one keyframe only, at the start, so the picture doesn't pulse during the cycle.
enc_cycle() { # file, output name, start s, cycle s, filter, fps, crf, sound gain dB
  local x=1.5 # crossfade, s
  local end; end=$(awk "BEGIN { print $4 + $x }")
  ffmpeg -v error -y -ss "$3" -t "$end" -i "$SRC/$1" -filter_complex "
    [0:v]$5,fps=$6,format=yuv420p,trim=duration=$4[v];
    [0:a]volume=$8dB,alimiter=limit=0.79:level=false,asplit=3[head][body][tail];
    [head]atrim=0:$x,asetpts=PTS-STARTPTS,afade=t=in:d=$x[h];
    [tail]atrim=$4:$end,asetpts=PTS-STARTPTS,afade=t=out:d=$x[t];
    [h][t]amerge=inputs=2,pan=stereo|c0=c0+c2|c1=c1+c3[join];
    [body]atrim=$x:$4,asetpts=PTS-STARTPTS[rest];
    [join][rest]concat=n=2:v=0:a=1[a]" -map '[v]' -map '[a]' \
    -c:a aac -b:a 96k -ar 48000 -ac 2 \
    -c:v libx264 -profile:v high -preset slow -crf "$7" \
    -x264-params "keyint=infinite:scenecut=0:bframes=0:no-fast-pskip=1:no-dct-decimate=1:aq-mode=3:aq-strength=1.2:deblock=-2,-2" \
    -movflags +faststart "$OUT/$2.mp4"
}
# Picture only, for a video that never repeats: the end dissolves into the start, so the
# loop has no jump.
enc_fade() { # file, output name, start s, duration s, filter, fps, crf
  local x=1.5 # dissolve, s
  ffmpeg -v error -y -ss "$3" -t "$(awk "BEGIN { print $4 + $x }")" -i "$SRC/$1" -filter_complex "
    [0:v]$5,fps=$6,format=yuv420p,split[a][b];
    [a]trim=0:$x,setpts=PTS-STARTPTS[head];
    [b]trim=$x,setpts=PTS-STARTPTS[body];
    [body][head]xfade=transition=fade:duration=$x:offset=$(awk "BEGIN { print $4 - $x }"),format=yuv420p[v]" -map '[v]' -an     -c:v libx264 -profile:v high -preset slow -crf "$7" -movflags +faststart "$OUT/$2.mp4"
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
# Siluett's picture is one 25.8 s cycle repeated 16 times, so a single cycle is all of it
enc_cycle "Siluett.mp4" w16-projection 25.8 25.8 "scale=1600:900:flags=lanczos" 25 25 15
# the black point is raised so the video's faint haze stays off the dark floor, as in the photos
enc_fade "Let it flow_ok.mp4" w16-floor 10 40 "scale=1280:720:flags=lanczos,colorlevels=rimin=0.07:gimin=0.07:bimin=0.09" 25 27
