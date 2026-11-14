#set document(title: "A Short Note on Decay", author: "Ore test fixture")
#set page(paper: "us-letter", margin: 2cm, columns: 2)
#set text(size: 10pt)
#set par(justify: true)
#set math.equation(numbering: "(1)")
= A Short Note on Decay

*Lemma 1.* Let $f: RR -> RR$ be differentiable with $f'(t) = -lambda f(t)$ for some $lambda > 0$. Then $f(t) = f(0) e^(-lambda t)$ for all $t >= 0$, and $lim_(t -> oo) f(t) = 0$.

_Proof._ Put $g(t) = f(t) e^(lambda t)$. Then $g'(t) = (f'(t) + lambda f(t)) e^(lambda t) = 0$, so $g$ is constant and $g(t) = g(0) = f(0)$. Since $e^(-lambda t) -> 0$ as $t -> oo$, the limit follows.

The half-life $t_(1\/2)$ solves $e^(-lambda t) = 1/2$, which gives
$ t_(1\/2) = (ln 2) / lambda. $
For a sum of $n$ independent terms with rates $lambda_1, dots, lambda_n$, the total $F(t) = sum_(i=1)^n c_i e^(-lambda_i t)$ is dominated by the smallest $lambda_i$ once $t$ is large, because each ratio $e^(-lambda_i t) \/ e^(-lambda_j t)$ with $lambda_i > lambda_j$ tends to zero.

*Remark.* When $lambda$ itself varies, the solution becomes $f(t) = f(0) exp(-integral_0^t lambda(s) dif s)$, and the condition $integral_0^oo lambda(s) dif s = oo$ is exactly what forces $f(t) -> 0$.
