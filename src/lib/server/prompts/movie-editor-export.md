Continue the completed edit as an export task. Do not redesign or rerender the movie.

Read `./premiere-xml-reference.md` before writing the project. It is the local authoring specification for this export format.

Create `./premiere-export.zip`, containing an Adobe Premiere-compatible Final Cut Pro 7 XML project (`xmeml` version 5), a short relinking README, and every media asset referenced by the timeline.

Reconstruct the delivered timeline from this conversation and the files left in the job. Preserve the source cuts and order, speed changes, separate video and audio tracks, music, sound effects, titles, overlays, transitions, fades, and volume choices as editable timeline elements where the XML format supports them. Represent an unsupported FFmpeg-only effect with the closest editable equivalent and note the difference in the README rather than flattening the entire movie.

Use the original job paths in XML so Premiere on this Mac can link immediately. Also copy each referenced asset into the ZIP for portable relinking. Include only timeline media, not contact sheets, transcripts, caches, or the flattened `vlogger-cut.mp4`.

Use `run_bash` only. Do not transcode media. Validate the XML with `xmllint --noout`, create the ZIP with macOS `ditto`, and inspect its file list before finishing. Return only after `./premiere-export.zip` exists.
