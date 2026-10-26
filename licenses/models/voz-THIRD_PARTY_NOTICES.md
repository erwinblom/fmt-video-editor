# Third-party notices - Voz

The Voz models derive from a third-party speech recogniser. Its license applies to the
component named below; nothing in the Desert Ant Labs Source-Available License overrides it.

## Base model

### Parakeet TDT 0.6B v3 - NVIDIA
- **Source:** https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en)
- **Use in Voz:** the acoustic encoder, decoder and token vocabulary in this repository are
  derived from this model.

## CC BY 4.0 attribution and modification notice

CC BY 4.0 requires attribution to the creator and a statement of what was changed. The
weights here have been:

- converted from NeMo/PyTorch to compiled Core ML (`.mlmodelc`),
- compressed by 6-bit palettization,
- restructured into the encoder, frontend and decoder graphs this runtime dispatches,
  with the token embedding table extracted to a sidecar file.

Weight values are otherwise unchanged from the base model.

Rights granted by CC BY 4.0 in the base model are unaffected by this repository. Every
recipient of that material receives an offer directly from NVIDIA under CC BY 4.0, and
nothing here restricts it. The Desert Ant Labs Source-Available License covers the Desert
Ant Labs contributions: the conversion, compression, packaging, and the Swift runtime that
drives these graphs.

## Evaluation data

- **FLEURS** - Google - **CC BY 4.0**. Used only to measure this export for the per-language
  table in the model card. Dataset: https://huggingface.co/datasets/google/fleurs
  No FLEURS audio or text is redistributed here.

## Runtime frameworks

Voz links only Apple system frameworks, including Core ML and AVFoundation. No third-party
runtime library is bundled.
