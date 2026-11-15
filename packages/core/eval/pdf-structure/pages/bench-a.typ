#set document(title: "Notes on Sequence Models", author: "Ore test fixture")
#set page(paper: "us-letter", margin: 2cm, columns: 2)
#set text(size: 10pt)
#set par(justify: true)
#set math.equation(numbering: "(1)")
= Notes on Sequence Models

== Attention
A query is compared with every key, the scores are scaled by the size of the keys and turned into weights, and the weights mix the values. Written out for a whole set of queries at once, this is
$ "Attention"(Q, K, V) = "softmax"((Q K^T) / sqrt(d_k)) V $
Several such maps run side by side on projections of the same inputs, and their outputs are joined and projected once more:
$ "MH"(Q, K, V) = "Concat"("head"_1, dots, "head"_h) W^O $
Each layer also applies the same small network to every position on its own:
$ "FFN"(x) = max(0, x W_1 + b_1) W_2 + b_2 $
Positions are given to the model as fixed waves of different lengths, one pair for each dimension:
$ P E_("pos", 2i) = sin("pos" \/ 10000^(2i \/ d_"model")) $
The learning rate rises for a while and then falls with the step number:
$ "lrate" = d_"model"^(-0.5) dot min("step"^(-0.5), "step" dot "warmup"^(-1.5)) $

#figure(
  table(columns: 5, stroke: none, align: center,
    table.hline(),
    table.cell(rowspan: 2)[Model], table.cell(colspan: 2)[BLEU], table.cell(colspan: 2)[Cost (FLOPs)],
    [EN-DE], [EN-FR], [EN-DE], [EN-FR],
    table.hline(stroke: 0.5pt),
    [Recurrent], [24.6], [39.9], [$2.3 dot 10^19$], [$1.4 dot 10^20$],
    [Convolutional], [25.2], [40.5], [$9.6 dot 10^18$], [$1.5 dot 10^20$],
    [Attention only], [28.4], [41.8], [$3.3 dot 10^18$], [$2.3 dot 10^19$],
    table.hline(),
  ),
  caption: [Translation quality against training cost.],
)

== Residual blocks
A block learns only what it adds to its input, which is passed around it unchanged:
$ y = F(x, {W_i}) + x $
With two layers inside the block, the added part is $F = W_2 sigma(W_1 x)$, and when the shapes differ a projection $W_s$ is applied to the input instead.

== Variational bounds
The log-likelihood of a point is bounded from below by a term that pulls the approximate posterior towards the prior and a term that rewards reconstruction:
$ cal(L) = -D_("KL") (q(z | x) || p(z)) + EE_(q(z|x)) [log p(x | z)] $
Sampling is moved outside the network so that gradients can pass through it:
$ z = mu + sigma dot.o epsilon, quad epsilon tilde.op cal(N)(0, I) $

#figure(
  table(columns: 4, stroke: none, align: (left, center, center, center),
    table.hline(),
    [Method], [Depth], [Top-1 error], [Top-5 error],
    table.hline(stroke: 0.5pt),
    [Plain], [18], [27.94 ± 0.12], [9.81],
    [Plain], [34], [28.54 ± 0.15], [10.02],
    [Residual], [18], [27.88 ± 0.10], [9.42],
    [Residual], [34], [*25.03 ± 0.09*], [*7.76*],
    table.hline(),
  ),
  caption: [Error rates on the validation set.],
)
The deeper plain network does worse than the shallower one, while the deeper residual network does better.
