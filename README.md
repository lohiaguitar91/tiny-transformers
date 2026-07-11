# Interactive Tech Explainers

Small, self-contained HTML demos that run the *actual algorithms* behind LLMs on tiny, visible examples — no external dependencies, open any `index.html` directly in a browser.

Started from a single question — "what was that Karpathy video?" — that turned into a full walk down the stack: tokenizer → embeddings → weights → logits → forward pass → GPU parallelism → weight initialization → backpropagation → architecture terms. This README is that walkthrough, in order, with links out to the interactive pieces at the points where they apply.

---

## 1. Where it started: Karpathy's "Deep Dive into LLMs like ChatGPT"

The jumping-off point was a question about how AI research actually works, versus how the *technology* works. The recommendation was Andrej Karpathy's ~3.5 hour **"Deep Dive into LLMs like ChatGPT"**, which walks the full training stack in sequence — pretraining, tokenization, inference, supervised finetuning, RL, RLHF — and shows the reasoning behind each stage rather than just naming it. Everything below is effectively a hands-on companion to the first third of that video.

## 2. Tokenization: the model's vocabulary is trained separately, once, then frozen

**→ [`bpe-tokenizer/index.html`](./bpe-tokenizer/index.html)**

First misconception to clear up: the tokenizer isn't part of the neural network, and "logic" isn't the right mental model for it. It's a small, separate artifact — a fixed vocabulary table plus an ordered list of merge rules — trained once on a text sample (not the full trillions-of-tokens training corpus) using **Byte Pair Encoding (BPE)**:

1. Start with individual characters/bytes as the base vocabulary.
2. Count every adjacent pair of symbols across the corpus.
3. Merge the *most frequent* pair into a new symbol.
4. Repeat, tens of thousands of times for a real tokenizer.

The result — typically 32k–200k vocab entries — is stored as two small files sitting next to the model weights, not inside them:
- **`vocab.json`** — symbol → id
- **`merges.txt`** — the ranked rule list, one merge per line; *rank = line number*, and that's what matters at encode time, not frequency recomputed on the fly.

Encoding new text replays those rules in rank order: repeatedly find the lowest-ranked applicable pair in the current text and fuse it, until nothing matches. The demo runs this exact algorithm live — train it step by step on a toy corpus, watch the merge ledger build, then type any word and watch it get tokenized with the learned rules, alongside a real Python implementation (`encode()` from `merges.txt`) generated from whatever you've trained.

**Key point that resolves the FineWeb-scale question:** tokenizer *size* doesn't scale with training corpus size. FineWeb being trillions of tokens describes how much text gets *fed through* the tokenizer during model training — the vocab table itself is fixed before that even starts, and stays a few MB regardless.

## 3. What a weight actually looks like

Before touching how weights are *used*, we looked at how they're *stored* — down to the byte:

- A weight is one IEEE-754 float32 number: 4 bytes, e.g. `0.035281047224998474` → `dc 82 10 3d` on disk.
- A weight *matrix* is just those numbers concatenated with no separators — a flat byte stream.
- What gives the bytes meaning is a **header** (JSON) sitting at the front of the checkpoint file, mapping tensor names → `{dtype, shape, offset}`. This is exactly the `safetensors` format real models ship in.
- The embedding table is the one place where a weight is genuinely *selected* — a token ID indexes directly into one row. Every other layer performs full matrix multiplication: **every number in the weight matrix participates in every computation, for every token, every time.** Nothing is "looked up" past the embedding step.

## 4. Logits and softmax

The final layer of the network outputs one raw score (a **logit**) per vocabulary entry — unnormalized, any real value, doesn't sum to 1. **Softmax** turns that into a real probability distribution:

```
softmax(logit_i) = exp(logit_i) / Σ exp(logit_j)
```

Logits (not post-softmax probabilities) are also where temperature, top-k, and top-p sampling get applied — which is the practical reason the raw scores are kept around rather than only ever working in probability space.

## 5. Forward pass, worked by hand: "demo" → "n"

**→ [`how-networks-learn/index.html`](./how-networks-learn/index.html)** *(forward pass section)*

Using the concrete example of predicting what follows the prefix `"demo"` — is it `n` (→ *demon*), a space, a period, or `l` (→ *demolish*)? — the demo builds a toy context vector, runs it through a weight matrix, and produces one logit per candidate simultaneously, then applies softmax to get real probabilities (e.g. `n: 58%, l: 26%, space: 10.6%, .: 5.3%`).

The important structural point: **all four logits come out of one matrix multiply.** There's no branch, no per-candidate lookup — every weight in the matrix contributes to every candidate's score, every time.

## 6. Why GPUs are better for this

Matrix multiplication is the overwhelming majority of the compute in a forward or backward pass, and it's embarrassingly parallel — each output value in `output = vector @ weight_matrix` is computed independently of every other output value. GPUs trade CPUs' "few very capable cores good at branching logic" for "thousands of simple cores good at doing the same multiply-add operation on massive amounts of data simultaneously" — plus tensor cores purpose-built for small matrix multiplies, and much higher memory bandwidth for streaming billions of weight values. This is also the direct link between parameter count and VRAM requirements for local inference.

## 7. How weights are created: random noise, shaped by training — not a library

Two separate decisions, made by two separate processes:

- **Architecture (shapes)** — humans decide `hidden_dim`, `layers`, `heads`, `vocab_size` (see §9). Fixed before training starts.
- **Actual values** — every weight matrix starts as **random noise** sampled from an initialization formula (e.g. `std=0.02` for GPT-style init, or Xavier/He formulas that scale by layer size to keep signal variance stable across many layers). Nothing before training encodes any knowledge — an untrained model produces pure noise as output.

There's no external "weight library" to draw from. Downloading a *pretrained* model means downloading someone else's already-*trained* checkpoint (the post-training numbers) — fine-tuning is the same gradient descent loop, just starting from that checkpoint instead of from random noise.

## 8. Backpropagation: how the network knows *what* to adjust

**→ [`how-networks-learn/index.html`](./how-networks-learn/index.html)** *(backward pass section)*

This is the mechanism tying everything above together, demonstrated on a real 2-layer toy network (not just the output layer, which is where an earlier single-layer demo stopped):

1. **Forward pass** — context vector → `W1` → tanh → `W2` → logits → softmax → loss against the target token.
2. **Backward pass (the chain rule, concretely):**
   - `W2`'s gradient is computed **first**, directly from the loss: `grad_logits = probs - onehot(target)`, then `grad_W2 = outer(grad_logits, hidden_activations)`.
   - `W1`'s gradient is computed **second**, using `W2`'s gradient: `grad_hidden = W2ᵀ @ grad_logits`, passed back through the tanh derivative, then `grad_W1 = outer(grad_hidden_raw, context_vector)`.
3. **Apply update:** `W -= learning_rate * gradient`, for every matrix, every step.

The one-sentence version: **the loss function only ever looks at the final output. Every earlier layer learns exclusively from the gradient handed to it by the layer just downstream — never from the label directly.** In a real 128-layer model, layer 1 is 127 links removed from the loss and still learns, because it only ever needs one link's worth of gradient at a time.

A worked example in the repo history: training a toy network exclusively on `"demo" → "n"` (standing in for "a corpus that's entirely a book about a demon") pushes `P(n)` from a random ~30% to ~91% in 20 gradient steps — and the demo interface lets you run forward/backward/apply yourself and watch the probability bars move.

## 9. Architecture terms glossary

**→ [`how-networks-learn/index.html`](./how-networks-learn/index.html)** *(architecture panel, top)*

| Term | Meaning |
|---|---|
| `hidden_dim` | Width of the vector representing each token as it flows through the network. Every layer operates on vectors this wide. |
| `layers` | Depth — how many times the vector passes through an attention+MLP block in sequence. Each pass refines the representation further. |
| `attention heads` | Each attention layer splits into this many parallel sub-computations, each of dimension `hidden_dim ÷ heads`. Heads subdivide width, they don't add it. |
| `vocab_size` | Number of distinct tokens the tokenizer can produce — sets the size of both the embedding table and the final logit layer. |

The demo panel has these as live sliders, recomputing `head_dim` and an approximate total parameter count (`~12·hidden_dim²` per layer for attention+MLP, plus `2·vocab_size·hidden_dim` for embed/unembed) as you drag them — useful for building intuition for why a "128 layers, 12288 hidden_dim, 96 heads, 100k vocab" config lands in the hundreds-of-billions-of-parameters range.

---

## Running locally

Both demos are single self-contained HTML files — no build step, no dependencies. Just open in a browser:

```bash
open bpe-tokenizer/index.html
open how-networks-learn/index.html
```
