#set document(title: "A Page of Identities", author: "Ore test fixture")
#set page(paper: "us-letter", margin: 2.2cm)
#set text(size: 11pt)
#set par(justify: true)
= A Page of Identities

The absolute value can be written piece by piece:
$ |x| = cases(x & "if" x >= 0, -x & "otherwise") $
Gauss found the sum of the first $n$ whole numbers by pairing the smallest with the largest:
$ sum_(i=1)^n i = (n(n+1)) / 2 $
The area under the bell curve follows from squaring the integral and changing to polar coordinates:
$ integral_0^oo e^(-x^2) dif x = sqrt(pi) / 2 $
For a two by two matrix the determinant is the difference of the diagonal products:
$ A = mat(a, b; c, d), quad det A = a d - b c $
A linear classifier turns its scores into probabilities with the softmax:
$ p(y | x) = exp(w_y^T x) / (sum_k exp(w_k^T x)) $
The policy gradient weighs each action's log-probability by the return of the episode it came from:
$ nabla_theta J(theta) = EE_(tau tilde.op pi_theta) [sum_t nabla_theta log pi_theta (a_t | s_t) R(tau)] $

#figure(
  table(columns: 6, stroke: 0.4pt, align: center,
    [Size], [Baseline], [Dropout], [Weight decay], [Both], [Time (h)],
    [Small], [71.2], [73.5], [72.0], [*74.1*], [0.8],
    [Medium], [74.9], [76.8], [75.6], [*77.3*], [2.1],
    [Large], [76.0], [78.2], [77.1], [*78.9*], [6.4],
    [Huge], [76.3], [78.6], [—], [*79.4*], [19.0],
  ),
  caption: [Accuracy by model size and regularizer.],
)

#figure(
  table(columns: 4, stroke: none, align: (left, left, center, center),
    table.hline(),
    [Task], [Metric], [Before], [After],
    table.hline(stroke: 0.5pt),
    table.cell(rowspan: 2)[Reading], [Exact match], [61.0], [68.4],
    [F1], [70.2], [76.9],
    table.cell(rowspan: 2)[Inference], [Accuracy], [80.5], [84.6],
    [Macro F1], [79.8], [83.9],
    table.hline(),
  ),
  caption: [Scores before and after fine-tuning.],
)
These identities come up again and again, and each one is worth knowing by heart.
