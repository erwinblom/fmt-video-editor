# Third-party notices

## openai/whisper-tiny

The weights in this repository are derived from
[`openai/whisper-tiny`](https://huggingface.co/openai/whisper-tiny), released by
OpenAI under the MIT License. The derivation removes the parameters this task
does not use, keeps the subgraph that predicts a language, and compresses the
result for on-device execution.

```
MIT License

Copyright (c) 2022 OpenAI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Evaluation corpora

Published accuracy figures are measured on
[FLEURS](https://huggingface.co/datasets/google/fleurs) (CC BY 4.0, Google) and
[VoxPopuli](https://huggingface.co/datasets/facebook/voxpopuli) (CC0, Meta).
Neither corpus is redistributed here.
