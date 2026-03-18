# Tessera — Sample Output

Real output from Tessera running against live Octant API data.

## Provider Chain

```
  #  PROVIDER    MODEL
  -  --------    -----
  1  claude-cli  sonnet
```

Uses Claude CLI (Claude Code Max plan subscription) — no API key required.

## Epoch Analysis (Octant Epoch 5)

```
Epoch 5 Analysis — 30 projects

  RANK  ADDRESS          ALLOCATED (ETH)  MATCHED (ETH)  SCORE  CLUSTER
  ----  -------          ---------------  -------------  -----  -------
  1     0x9531C0...1306  2.2694           26.6396        89.5   1
  2     0xBCA488...7d62  2.1218           22.8011        79.4   2
  3     0x3250c2...A62a  0.8019           32.0558        73.9   3
  4     0xfcBf17...F863  2.0895           20.2034        73.8   3
  5     0x02Cb3C...c953  2.0687           13.6634        60.7   2
  6     0xa095Ee...C854  2.1084           12.9916        60.1   3
  7     0x15c941...5A4f  0.5554           19.3652        44.9   3
  8     0x992A3a...1761  0.5262           16.8479        39.5   0
  9     0x0cbF31...DF29  0.5926           15.0482        37.2   0
  10    0x87fEEd...1B05  0.5376           11.6983        29.7   3
  11    0x2DCDF8...eAc9  0.4761           12.2147        29.6   0
  12    0x576edC...5d20  0.2302           9.6797         20.3   2
  13    0x09A38B...b824  0.4090           7.8621         20.0   2
  14    0xFC1436...9ed8  0.2455           9.1644         19.6   3
  15    0xe7d4Ac...2D98  0.2301           8.8420         18.7   3
  16    0x000807...40D1  0.3165           7.3011         17.2   2
  17    0x0B7246...2F95  0.2682           7.3633         16.5   2
  18    0xd1B8dB...95d1  0.2759           7.0109         16.0   3
  19    0x4C6fd5...D6eb  0.3384           6.1358         15.4   1
  20    0xF41a98...8F7a  0.1832           6.1760         12.7   0
  21    0x5597cD...C537  0.2667           5.1940         12.3   3
  22    0xa83a92...0704  0.1344           5.5683         10.7   2
  23    0x533905...efc4  0.0994           5.5683         10.0   1
  24    0x7380A4...21B5  0.2443           2.8375         7.3    1
  25    0x08e40e...6FFA  0.0755           4.1748         6.9    3
  26    0x9be726...8Bcf  0.0420           2.4463         2.9    2
  27    0x7Dd488...407C  0.0168           1.9680         1.6    3
  28    0x1337E2...f0a9  0.0196           1.7497         1.2    3
  29    0x809C9f...7714  0.0604           1.1603         0.8    1
  30    0xfFbD35...0e00  0.0268           1.2461         0.3    2
```

Projects are ranked by composite score (40% allocated + 60% matched, normalized 0-100)
and grouped into 4 clusters via K-means clustering.

## Funding Anomaly Detection (Epoch 5)

```
Funding Anomaly Report — Epoch 5

  Total Donations      1902
  Unique Donors        422
  Total Amount         17.6302 ETH
  Mean Donation        0.009269 ETH
  Median Donation      0.000146 ETH
  Max Donation         2.049135 ETH
  Whale Concentration  97.9%

  Flags:
    - Top 10% of donors control 97.9% of total funding
```

The anomaly detector identified extreme whale concentration in Epoch 5:
the top 10% of donors controlled 97.9% of all funding, which is a
common indicator of funding centralization in quadratic funding systems.

## Status Check

```
  SERVICE          STATUS
  -------          ------
  Octant API       connected (epoch 12)
  Gitcoin GraphQL  connected
  OSO API          connected
  AI Providers     1 configured
```

## Unit Tests

```
=== RUN   TestWeiToEth
--- PASS: TestWeiToEth (0.00s)
=== RUN   TestComputeCompositeScores
--- PASS: TestComputeCompositeScores (0.00s)
=== RUN   TestSimpleKMeans
--- PASS: TestSimpleKMeans (0.00s)
=== RUN   TestDetectAnomalies
--- PASS: TestDetectAnomalies (0.00s)
=== RUN   TestDetectAnomaliesWhaleFlag
--- PASS: TestDetectAnomaliesWhaleFlag (0.00s)
=== RUN   TestDetectAnomaliesCoordinatedFlag
--- PASS: TestDetectAnomaliesCoordinatedFlag (0.00s)
PASS
ok  github.com/yeheskieltame/tessera/internal/analysis  0.628s
```

13 tests, all passing.
