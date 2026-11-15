"""Spacing out reviews: written for Ore's intake tests."""

GAPS = [1, 3, 7, 14]


def next_gap(*reviews):
    # *reviews* are the days since each review
    for gap in GAPS:
        if gap > len(reviews):
            return gap
    return GAPS[-1] * 2


if __name__ == "__main__":
    print(next_gap(1, 2))
