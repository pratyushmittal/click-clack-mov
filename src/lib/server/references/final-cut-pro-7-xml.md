# Final Cut Pro 7 XML (`xmeml` version 5) authoring reference

Last reviewed: 2026-07-17

This is a practical, self-contained reference for creating editable timelines that Adobe Premiere can import. It summarizes the parts of Apple's retired Final Cut Pro 7 XML Interchange Format that Click Clack Mov needs. It is not a replacement for testing an import in Premiere, and it deliberately omits capture-device, film-database, multicam, Apple Events, and legacy tape-deck fields that are irrelevant to our exports.

## 1. Export contract

Create a UTF-8, well-formed XML document with this outer structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <project>
    <name>Click Clack Mov</name>
    <children>
      <!-- bins, master clips, and one sequence -->
    </children>
  </project>
</xmeml>
```

Use `xmeml`, not modern `fcpxml`. Keep element order consistent with the examples in this file. XML element names are case-sensitive. Escape XML text and URL-encode media paths.

The exported project should contain:

- a sequence representing the delivered rough cut;
- one `clipitem` for each occurrence of source video, source audio, music, sound effect, still, or generated graphic;
- separate tracks for source video, titles/graphics, source audio, music, and sound effects;
- `transitionitem`, `filter`, `generatoritem`, markers, and links where the interchange format can express the edit;
- bins containing referenced source assets when useful for organization.

Do not include contact sheets, transcripts, caches, or the flattened final movie as timeline media.

## 2. Frames are the timeline unit

Nearly all timing values are integer frames, not seconds.

Choose one sequence rate before generating the XML. Convert seconds to frames consistently:

```text
frames = round(seconds * actualFramesPerSecond)
```

For ordinary integer rates:

| FPS | `timebase` | `ntsc`  |
| --- | ---------: | ------- |
| 24  |         24 | `FALSE` |
| 25  |         25 | `FALSE` |
| 30  |         30 | `FALSE` |
| 50  |         50 | `FALSE` |
| 60  |         60 | `FALSE` |

For NTSC-reduced rates:

| FPS    | `timebase` | `ntsc` |
| ------ | ---------: | ------ |
| 23.976 |         24 | `TRUE` |
| 29.97  |         30 | `TRUE` |
| 59.94  |         60 | `TRUE` |

Use the same sequence rate on sequence timing, clip items, transitions, generators, and timecode unless a source genuinely requires a different local rate.

A rate block is:

```xml
<rate>
  <timebase>30</timebase>
  <ntsc>FALSE</ntsc>
</rate>
```

### Timeline placement versus source selection

For a `clipitem`:

- `in` and `out` select frames from the source media;
- `start` and `end` place that selection in the containing sequence;
- `duration` describes the clip or source length at its applicable rate;
- `out` and `end` are exclusive boundaries in normal authoring practice;
- `start`, `end`, `in`, and `out` must describe the same visible duration unless a speed effect changes it.

For an unchanged-speed clip:

```text
sourceFrames = out - in
timelineFrames = end - start
sourceFrames == timelineFrames
```

For a transition, an adjacent clip may use `start=-1` or `end=-1`; the importer derives that boundary from the transition. Do not use `-1` on ordinary hard cuts.

Avoid cumulative drift: calculate every boundary from absolute seconds and the chosen sequence rate rather than repeatedly adding rounded durations.

## 3. Sequence skeleton

```xml
<sequence id="sequence-1">
  <name>Click Clack Mov Rough Cut</name>
  <duration>1800</duration>
  <rate>
    <timebase>30</timebase>
    <ntsc>FALSE</ntsc>
  </rate>
  <timecode>
    <rate>
      <timebase>30</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <string>00:00:00:00</string>
    <frame>0</frame>
    <displayformat>NDF</displayformat>
  </timecode>
  <media>
    <video>
      <format>
        <samplecharacteristics>
          <rate>
            <timebase>30</timebase>
            <ntsc>FALSE</ntsc>
          </rate>
          <width>1920</width>
          <height>1080</height>
          <anamorphic>FALSE</anamorphic>
          <pixelaspectratio>square</pixelaspectratio>
          <fielddominance>none</fielddominance>
        </samplecharacteristics>
      </format>
      <track><!-- primary picture --></track>
      <track><!-- titles and overlays --></track>
    </video>
    <audio>
      <format>
        <samplecharacteristics>
          <depth>16</depth>
          <samplerate>48000</samplerate>
        </samplecharacteristics>
      </format>
      <track><!-- source/dialogue left or stereo item --></track>
      <track><!-- source/dialogue right when represented separately --></track>
      <track><!-- music --></track>
      <track><!-- sound effects --></track>
    </audio>
  </media>
</sequence>
```

Set sequence `duration` to the greatest occupied `end` frame. Prefer square pixels, progressive fields, and the actual rendered dimensions. Codec-specific `appspecificdata` is optional and should be omitted unless known to be correct.

Track order is layer order. Later/higher video tracks appear above earlier/lower tracks. Keep semantically different audio on separate tracks so the editor retains control.

A track may include:

```xml
<enabled>TRUE</enabled>
<locked>FALSE</locked>
```

Omitting `enabled` normally means enabled.

## 4. Media files and IDs

Every reusable entity needs a unique, XML-safe ID. Use deterministic IDs containing letters, digits, hyphens, and underscores, for example:

```text
file-source-0
video-clip-12
audio-clip-12-1
title-3
```

Define complete `file` metadata on its first occurrence. Later occurrences can reference the same file by ID:

```xml
<file id="file-source-0">
  <name>IMG_1001.mov</name>
  <pathurl>file:///absolute/path/to/IMG_1001.mov</pathurl>
  <rate>
    <timebase>30</timebase>
    <ntsc>FALSE</ntsc>
  </rate>
  <duration>9120</duration>
  <timecode>
    <rate>
      <timebase>30</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <string>00:00:00:00</string>
    <frame>0</frame>
    <displayformat>NDF</displayformat>
  </timecode>
  <media>
    <video>
      <samplecharacteristics>
        <width>1920</width>
        <height>1080</height>
      </samplecharacteristics>
    </video>
    <audio>
      <samplecharacteristics>
        <depth>16</depth>
        <samplerate>48000</samplerate>
      </samplecharacteristics>
      <channelcount>2</channelcount>
    </audio>
  </media>
</file>
```

A later reference may be:

```xml
<file id="file-source-0" />
```

`pathurl` requirements:

- use an absolute local file URL beginning with `file:///` or `file://localhost/`;
- URL-encode spaces as `%20` and encode other characters that are not legal URL characters;
- XML-escape `&` as `&amp;` after URL encoding;
- retain the original absolute job path for immediate local linking;
- include a packaged copy of every referenced asset for manual relinking elsewhere.

Use `python3` with `pathlib.Path(path).resolve().as_uri()` when possible instead of constructing file URLs manually.

## 5. Video clip items

```xml
<clipitem id="video-clip-1">
  <name>IMG_1001.mov</name>
  <duration>9120</duration>
  <rate>
    <timebase>30</timebase>
    <ntsc>FALSE</ntsc>
  </rate>
  <start>0</start>
  <end>150</end>
  <in>1260</in>
  <out>1410</out>
  <file id="file-source-0"><!-- full definition on first use --></file>
  <sourcetrack>
    <mediatype>video</mediatype>
    <trackindex>1</trackindex>
  </sourcetrack>
  <link><linkclipref>video-clip-1</linkclipref></link>
  <link><linkclipref>audio-clip-1-1</linkclipref></link>
  <link><linkclipref>audio-clip-1-2</linkclipref></link>
</clipitem>
```

Important distinctions:

- `duration` should describe the source item's duration when it is acting as source metadata; the visible sequence extent is `end - start`;
- `sourcetrack/mediatype` is `video` and `trackindex` is normally `1`;
- multiple uses of the same file require distinct `clipitem` IDs but share the `file` ID;
- use `enabled=FALSE` only when intentionally delivering a disabled timeline item.

## 6. Audio clip items and links

Represent source audio, music, and sound effects as audio `clipitem` elements on meaningful tracks.

```xml
<clipitem id="audio-clip-1-1">
  <name>IMG_1001.mov</name>
  <duration>9120</duration>
  <rate>
    <timebase>30</timebase>
    <ntsc>FALSE</ntsc>
  </rate>
  <start>0</start>
  <end>150</end>
  <in>1260</in>
  <out>1410</out>
  <file id="file-source-0" />
  <sourcetrack>
    <mediatype>audio</mediatype>
    <trackindex>1</trackindex>
  </sourcetrack>
  <link><linkclipref>video-clip-1</linkclipref></link>
  <link><linkclipref>audio-clip-1-1</linkclipref></link>
  <link><linkclipref>audio-clip-1-2</linkclipref></link>
</clipitem>
```

For a second source channel, use another audio track and `trackindex=2`. If a file is mono or has only one audio source track, do not invent a second linked item.

Each linked occurrence must use unique clip-item IDs. The linked video and audio items should have matching source and sequence boundaries unless an intentional sync offset exists.

Music and sound effects normally do not link to video. They still need independent `clipitem` IDs, a file reference, timeline boundaries, and an audio source track.

## 7. Audio gain and fades

FCP7 XML represents clip volume with an `Audio Levels` filter. The `level` value is linear gain, not decibels:

```text
level = 10 ^ (decibels / 20)
decibels = 20 * log10(level)
```

Examples:

|  dB | Linear level |
| --: | -----------: |
|   0 |          1.0 |
|  -3 |       0.7079 |
|  -6 |       0.5012 |
| -12 |       0.2512 |
| -18 |       0.1259 |

A constant level:

```xml
<filter>
  <effect>
    <name>Audio Levels</name>
    <effectid>audiolevels</effectid>
    <effecttype>audiolevels</effecttype>
    <mediatype>audio</mediatype>
    <parameter>
      <name>Level</name>
      <parameterid>level</parameterid>
      <value>0.5012</value>
    </parameter>
  </effect>
</filter>
```

For a fade or ducking envelope, replace the fixed `value` with ordered `keyframe` entries using timeline-relative frame positions:

```xml
<parameter>
  <name>Level</name>
  <parameterid>level</parameterid>
  <keyframe><when>0</when><value>0.0</value></keyframe>
  <keyframe><when>15</when><value>0.5012</value></keyframe>
  <keyframe><when>135</when><value>0.5012</value></keyframe>
  <keyframe><when>150</when><value>0.0</value></keyframe>
</parameter>
```

Keep envelopes simple. Adobe warns that audio gain, pan, and level translation is not always exact, so describe critical mix assumptions in the package README.

## 8. Transitions

A transition is a sibling of clip items inside a track:

```xml
<transitionitem>
  <rate>
    <timebase>30</timebase>
    <ntsc>FALSE</ntsc>
  </rate>
  <start>300</start>
  <end>315</end>
  <alignment>center</alignment>
  <effect>
    <name>Cross Dissolve</name>
    <effectid>Cross Dissolve</effectid>
    <effecttype>transition</effecttype>
    <mediatype>video</mediatype>
    <startratio>0</startratio>
    <endratio>1</endratio>
    <reverse>FALSE</reverse>
  </effect>
</transitionitem>
```

Allowed alignment values are `start`, `center`, `end`, `start-black`, and `end-black`.

For a centered transition between two clips:

- the outgoing clip normally uses `end=-1`;
- the incoming clip normally uses `start=-1`;
- the transition's explicit `start` and `end` define the overlap;
- source handles must be long enough to cover the overlap.

Prefer standard transitions that Premiere recognizes, especially Cross Dissolve and simple audio crossfades. Do not claim an FFmpeg transition is editable unless a corresponding XML transition is actually encoded. If no reliable equivalent exists, retain the hard cut and document the visual difference.

## 9. Titles, text, stills, and overlays

### Editable text generator

A plain title can be represented as a `generatoritem` on an upper video track:

```xml
<generatoritem id="title-1">
  <name>Main Title</name>
  <duration>90</duration>
  <rate>
    <timebase>30</timebase>
    <ntsc>FALSE</ntsc>
  </rate>
  <start>300</start>
  <end>390</end>
  <in>0</in>
  <out>90</out>
  <effect>
    <name>Text</name>
    <effectid>Text</effectid>
    <effecttype>generator</effecttype>
    <mediatype>video</mediatype>
    <parameter>
      <name>Text</name>
      <parameterid>str</parameterid>
      <value>OUR LITTLE ADVENTURE</value>
    </parameter>
  </effect>
</generatoritem>
```

Text-generator translation varies between editors. Use it for simple editable wording. Put styling details in the README when the interchange format cannot reliably preserve the exact custom font, tracking, shadow, or layout.

### Rendered graphic fallback

When exact appearance matters more than editable typography, reference a PNG with alpha as a normal video `clipitem` on an upper track:

```xml
<stillframe>TRUE</stillframe>
<alphatype>straight</alphatype>
```

Include the PNG and, when available, its source text or generation script in the package. Never flatten all titles and picture into one movie merely to preserve appearance.

### Overlay placement

Separate overlays by purpose:

- V1: primary picture;
- V2: titles and chapter cards;
- V3: additional graphics, masks, or picture-in-picture media.

Use `compositemode` only when required. Common values include `normal`, `add`, `multiply`, `screen`, `difference`, `hardlight`, `softlight`, `darken`, and `lighten`.

## 10. Markers

Sequence markers make editorial intent visible after import:

```xml
<marker>
  <name>Chapter: Market</name>
  <comment>Theme changes from travel to food.</comment>
  <in>900</in>
  <out>900</out>
</marker>
```

Use markers for chapter changes, title positions, uncertain translations, or places needing human review. Marker timing uses frames at the containing sequence or clip rate.

## 11. Filters and effect parameters

A filter belongs inside a `clipitem`:

```xml
<filter>
  <start>-1</start>
  <end>-1</end>
  <effect>
    <name>Effect Name</name>
    <effectid>Stable Effect Identifier</effectid>
    <effecttype>filter</effecttype>
    <mediatype>video</mediatype>
    <parameter>
      <name>Parameter Name</name>
      <parameterid>stable-parameter-id</parameterid>
      <value>1</value>
    </parameter>
  </effect>
</filter>
```

`effect` requires a name, effect ID, effect type, and media type. A parameter requires a name or parameter ID and either a fixed value or keyframes. Unknown effects may import as generic placeholders or disappear.

Use only well-known, portable effects. Do not invent identifiers for arbitrary FFmpeg filters. For FFmpeg-only color transforms, masks, warps, or compositing:

1. encode the closest conservative editable transform when reliable;
2. keep affected layers separate;
3. package generated overlay assets or scripts;
4. document the difference in the README.

## 12. Speed changes

FCP7 XML represents speed through the `Time Remap` effect and special keyframes. `when` is a position in the timeline clip item; `value` is a position in the source media. Constant speed produces a linear relation between these values.

For a constant forward speed:

```text
timelineDuration = round(sourceDuration / speed)
first keyframe: when = 0, value = sourceIn
last keyframe:  when = timelineDuration, value = sourceOut
```

The last keyframe and reverse playback have historical one-frame adjustments in Final Cut Pro. Version 5 may also use `anchoroffset` to preserve the intended source frame. Because speed XML is easy to make subtly wrong:

- encode constant speed only when it materially affects the delivered edit;
- use a linear `graphdict` Time Remap mapping;
- ensure the final `when` agrees with the clip item's timeline duration;
- preserve the original source `in` and `out` intent;
- add a marker and README note for every speed change;
- verify the imported duration and source boundaries in Premiere.

If a reliable editable speed mapping cannot be produced, keep the original source item and document the intended percentage rather than silently substituting a pre-rendered movie for the whole sequence.

## 13. Project bins and master clips

A project and bin use `children`:

```xml
<project>
  <name>Click Clack Mov</name>
  <children>
    <bin>
      <name>Source Footage</name>
      <children>
        <!-- optional master clip definitions -->
      </children>
    </bin>
    <bin>
      <name>Music and Sound</name>
      <children><!-- optional audio master clips --></children>
    </bin>
    <sequence id="sequence-1"><!-- timeline --></sequence>
  </children>
</project>
```

A minimal sequence-only document can import, but a project with clearly named bins is easier to continue editing. Avoid duplicating large media definitions unnecessarily; use IDs and references.

## 14. XML correctness checklist

Before packaging:

1. Confirm the prologue, `<!DOCTYPE xmeml>`, and `<xmeml version="5">`.
2. Run `xmllint --noout project.xml` for XML well-formedness.
3. Ensure every opened element closes in the required order.
4. Ensure every `id` is unique for its definition and every reference resolves.
5. Ensure each file URL is absolute, local, URL-encoded, and points to an existing file.
6. Ensure sequence duration is at least the greatest occupied end frame.
7. Ensure normal clips have nonnegative `start`, `end`, `in`, and `out` values.
8. Use `-1` clip boundaries only around a transition.
9. Ensure `out > in` and `end > start` for ordinary clips.
10. Ensure linked audio and video occurrences refer to the same edit and remain in sync.
11. Ensure all transition overlaps have sufficient source handles.
12. Ensure audio gain is linear, not a dB value written directly.
13. Ensure XML text escapes `&`, `<`, `>`, quotes where required, and non-ASCII text remains UTF-8.
14. Inspect the ZIP listing and verify every referenced packaged media file is present.
15. Include a README explaining relinking and any approximate or unsupported translation.

DTD validation, if a trusted version 5 DTD is locally available, is stronger than a well-formedness check:

```bash
xmllint --noout --dtdvalid fcpxmlv5.dtd project.xml
```

Passing DTD validation still does not guarantee that an editor will import every semantic detail correctly.

## 15. Premiere compatibility expectations

Premiere can exchange standard Final Cut Pro XML, but the format is a legacy interchange rather than a native Premiere project. Preserve the editable structure first and be explicit about limitations.

Usually useful to transfer:

- source media references;
- clip boundaries and ordering;
- multiple video and audio tracks;
- linked picture and source audio;
- sequence dimensions, rate, and timecode;
- standard dissolves and simple transitions;
- markers;
- some generators, filters, motion values, speed changes, and audio levels.

May translate imperfectly or not at all:

- third-party effects and plugins;
- complex FFmpeg filter graphs;
- exact custom typography;
- advanced masks and blend behavior;
- some transition variants;
- detailed audio pan, gain, and automation;
- renderer-specific metadata and UI layout.

Never describe an approximation as exact. Put unsupported details in the package README and add timeline markers where human review is needed.

## 16. Packaging layout

Use a predictable portable package:

```text
premiere-export/
  Click-Clack-Mov.xml
  README.txt
  Media/
    Source Footage/
    Music/
    Sound Effects/
    Graphics/
  Supporting Files/
    title-text.txt
    timeline-notes.txt
```

Use APFS clone copies when preparing the folder if convenient, but create a normal ZIP for download. Preserve original file extensions and avoid filename collisions by prefixing deterministic indexes when needed.

Create the archive on macOS:

```bash
rm -f premiere-export.zip
/usr/bin/ditto -c -k --sequesterRsrc --keepParent premiere-export premiere-export.zip
/usr/bin/unzip -l premiere-export.zip
```

The XML may retain original absolute job URLs for immediate linking on the current Mac. The README must tell users to relink missing media to the packaged `Media` directories when opening elsewhere.

## 17. Final authoring rule

The XML must describe the actual rough cut, not a plausible recreation. Derive clip order, boundaries, speed, audio usage, titles, music, sound effects, and transitions from the completed editing conversation and its generated scripts. Keep layers editable wherever the interchange format supports them, package every referenced asset, and document every material approximation.
