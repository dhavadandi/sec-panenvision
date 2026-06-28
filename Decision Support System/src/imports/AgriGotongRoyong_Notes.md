# 🌾 AgriGotongRoyong — Catatan Analisis Lengkap (Data + Hasil)
> **Kompetisi:** Satria Data 2026 · **Studi kasus:** 35 Kab/Kota Jawa Tengah  
> **Pipeline:** Preprocessing → Feature Engineering → Peramalan Produksi (ML/Statistik) → Derivasi Neraca Probabilistik → Optimasi Distribusi (MILP) → Dashboard  
> **Sumber data:** `dataset_jateng_bulanan_2019_2025.xlsx` · `dashboard_data.csv` · `Fase2_3_TFT_AgriGotongRoyong.ipynb`

---

## BAGIAN 1 — KPI UTAMA

| Metrik | Nilai |
|--------|-------|
| Total observasi dataset historis | **20.580** (35 kab × 7 komoditas × 84 bulan) |
| Jumlah deret waktu (seri) | **245** (balanced panel sempurna) |
| Periode historis | Jan 2019 – Des 2025 (84 bulan) |
| Horizon forecast deploy | **Jan – Jun 2026** (6 bulan) |
| Total baris dashboard_data.csv | **1.470** (35 × 7 × 6) |
| Split evaluasi | **80/20 temporal** (≈67 bln latih · 17 bln uji) |
| Model terbaik titik (deploy) | **LightGBM + Conformal Prediction** |
| Model terbaik interval → MILP | **SARIMAX** (ekspor P10/P50/P90 parametrik) |
| Status neraca (1.470 obs deploy) | **Defisit: 777** · Surplus: 693 |
| Komoditas defisit struktural | **Kedelai** (207 dari 210 obs = 98.6% defisit) |
| Komoditas paling surplus | **Jagung** (183 dari 210 obs = 87.1% surplus) |
| Outlier IQR di data historis | **~21%** — tidak dibuang (sah secara substantif) |
| Missing value | **0** (panel sempurna, tidak perlu imputasi) |

---

## BAGIAN 2 — METODOLOGI

### 2.1 Pendekatan Inti
Target peramalan adalah **`produksi_ton`** (lebih stabil & musiman), bukan `surplus_defisit_ton` langsung. Surplus diturunkan via identitas eksak:

```
surplus = produksi × rendemen − konsumsi
```

| Komoditas | Rendemen |
|-----------|:---:|
| Padi | **0.571** |
| Jagung, Kacang Hijau, Kacang Tanah, Kedelai, Ubi Jalar, Ubi Kayu | **1.0** |

### 2.2 Fitur Model (Direct Multi-Horizon, anti-leakage)

| Fitur | Keterangan |
|-------|-----------|
| `prod_lag12`, `prod_lag24` | Produksi 1–2 tahun lalu (tersedia di origin) |
| `prod_seasmean` | Klimatologi musiman per (kab, komoditas, bulan) — dihitung dari train saja |
| `month_sin`, `month_cos` | Encoding musim siklus |
| `flag_panenraya` | Bulan 3–4 = 1 |
| `flag_paceklik` | Bulan 11–12–1 = 1 |
| `curah_hujan_mm` | Kovariat eksogen |
| `populasi_jiwa` | Kovariat eksogen |

> **Anti-leakage:** `luas_panen_ha` dan `produktivitas_ku_ha` periode-sama **TIDAK** dipakai sebagai fitur karena `produksi = luas × produktivitas / 10`.

### 2.3 Model yang Diuji

| # | Model | Tipe | Probabilistik | Keterangan |
|---|-------|------|:---:|-----------|
| 1 | Seasonal-naive | Baseline | ✗ | Referensi MASE |
| 2 | SARIMA | Statistik | ✗ | Order (1,1,1)(1,1,1)12 |
| 3 | SARIMAX | Statistik + Exog | ✓ | P10/P50/P90 parametrik → MILP |
| 4 | XGBoost | Tree-based | ✗ | Direct multi-horizon |
| 5 | LightGBM | Tree-based | ✗ | **Titik terbaik** |
| 6 | CatBoost | Tree MultiQuantile | ✓ | Native interval |
| 7 | SARIMAX+XGB (Hybrid) | Statistik + Residual ML | ✗ | XGB koreksi residual SARIMAX |
| 8 | DeepAR | RNN Global | ✓ | Butuh GPU (Colab) |
| 9 | **LightGBM+Conformal** | Tree + Distribution-free | ✓ | **Deploy** — cakupan terjamin |

### 2.4 Metrik Evaluasi
**MASE** (Mean Absolute Scaled Error, skala seasonal-naive m=12). **MASE < 1 = mengalahkan baseline.**

---

## BAGIAN 3 — NERACA PER KOMODITAS (Ringkasan Deploy Jan–Jun 2026)

| Komoditas | % Defisit | % Surplus | Prod. Median (ton) | Surplus P50 Median (ton) | Catatan |
|-----------|:---:|:---:|---:|---:|---------|
| Jagung | 12.9% | 87.1% | 4.264 | +4.217 | Surplus besar, pemasok utama |
| Kacang Hijau | 60.0% | 40.0% | 14 | −11 | Mayoritas defisit |
| Kacang Tanah | 47.1% | 52.9% | 25 | +1 | Tipis surplus |
| **Kedelai** | **98.6%** | **1.4%** | 24 | **−956** | **Defisit struktural nasional** |
| Padi | 42.4% | 57.6% | 18.435 | +1.847 | Variasi antar-wilayah besar |
| Ubi Jalar | 62.4% | 37.6% | 151 | −55 | Mayoritas defisit |
| Ubi Kayu | 46.7% | 53.3% | 1.295 | +192 | Tipis surplus |

---

## BAGIAN 4 — NERACA BULANAN PER KOMODITAS (Seluruh Jawa Tengah, Jan–Jun 2026)

### Jagung

| Bulan | Surplus Kab | Defisit Kab | Prod. Total (ton) | Konsumsi Total (ton) | Neraca P50 (ton) | Kirim (ton) |
|-------|:-----------:|:-----------:|---:|---:|---:|---:|
| Jan 2026 | 30 | 5 | 244.450 | 2.294 | +242.157 | 122 |
| Feb 2026 | 30 | 5 | 306.880 | 2.295 | +304.584 | 137 |
| Mar 2026 | 30 | 5 | 434.384 | 2.297 | +432.086 | 100 |
| Apr 2026 | 31 | 4 | 428.125 | 2.299 | +425.826 | 80 |
| Mei 2026 | 31 | 4 | 321.202 | 2.301 | +318.901 | 80 |
| Jun 2026 | 31 | 4 | 303.786 | 2.302 | +301.484 | 100 |

### Kacang Hijau

| Bulan | Surplus Kab | Defisit Kab | Prod. Total (ton) | Konsumsi Total (ton) | Neraca P50 (ton) |
|-------|:-----------:|:-----------:|---:|---:|---:|
| Jan 2026 | 11 | 24 | 2.385 | 1.042 | +1.342 |
| Feb 2026 | 12 | 23 | 2.482 | 1.043 | +1.439 |
| Mar 2026 | 15 | 20 | 4.266 | 1.044 | +3.222 |
| Apr 2026 | 15 | 20 | 5.939 | 1.045 | +4.895 |
| Mei 2026 | 16 | 19 | 8.165 | 1.045 | +7.120 |
| Jun 2026 | 15 | 20 | 10.229 | 1.046 | +9.183 |

### Kedelai

| Bulan | Surplus Kab | Defisit Kab | Prod. Total (ton) | Konsumsi Total (ton) | Neraca P50 (ton) |
|-------|:-----------:|:-----------:|---:|---:|---:|
| Jan 2026 | 0 | 35 | 2.301 | 34.646 | **−32.345** |
| Feb 2026 | 0 | 35 | 2.414 | 34.672 | **−32.258** |
| Mar 2026 | 0 | 35 | 3.474 | 34.699 | **−31.225** |
| Apr 2026 | 1 | 34 | 4.661 | 34.725 | **−30.064** |
| Mei 2026 | 1 | 34 | 6.355 | 34.752 | **−28.396** |
| Jun 2026 | 1 | 34 | 8.194 | 34.778 | **−26.584** |

> Kedelai: defisit Jawa Tengah ±180.000 ton selama 6 bulan — bergantung penuh pada impor/distribusi luar provinsi.

### Padi

| Bulan | Surplus Kab | Defisit Kab | Prod. Total (ton) | Konsumsi Total (ton) | Neraca P50 (ton) | Kirim (ton) |
|-------|:-----------:|:-----------:|---:|---:|---:|---:|
| Jan 2026 | 8 | 27 | 351.474 | 267.168 | −66.511 | 11.876 |
| Feb 2026 | 16 | 19 | 640.803 | 267.372 | +98.462 | 82.473 |
| Mar 2026 | 25 | 10 | 1.094.891 | 267.577 | +357.496 | 30.756 |
| Apr 2026 | 26 | 9 | 1.313.786 | 267.782 | +482.259 | 24.273 |
| Mei 2026 | 24 | 11 | 1.045.736 | 267.986 | +329.024 | 36.152 |
| Jun 2026 | 22 | 13 | 921.487 | 268.191 | +257.886 | 43.731 |

> Januari 2026 padi masih defisit Jateng (27 kab defisit) → puncak panen mulai Maret–April.

### Ubi Jalar

| Bulan | Surplus Kab | Defisit Kab | Prod. Total (ton) | Konsumsi Total (ton) | Neraca P50 (ton) |
|-------|:-----------:|:-----------:|---:|---:|---:|
| Jan 2026 | 11 | 24 | 9.270 | 10.393 | −1.122 |
| Feb 2026 | 10 | 25 | 9.684 | 10.400 | −717 |
| Mar 2026 | 15 | 20 | 12.895 | 10.408 | +2.487 |
| Apr 2026 | 14 | 21 | 14.199 | 10.416 | +3.783 |
| Mei 2026 | 14 | 21 | 14.539 | 10.424 | +4.115 |
| Jun 2026 | 15 | 20 | 15.086 | 10.432 | +4.654 |

### Ubi Kayu

| Bulan | Surplus Kab | Defisit Kab | Prod. Total (ton) | Konsumsi Total (ton) | Neraca P50 (ton) | Kirim (ton) |
|-------|:-----------:|:-----------:|---:|---:|---:|---:|
| Jan 2026 | 16 | 19 | 142.851 | 40.891 | +101.960 | 19.557 |
| Feb 2026 | 16 | 19 | 164.042 | 40.922 | +123.120 | 20.140 |
| Mar 2026 | 19 | 16 | 192.213 | 40.953 | +151.260 | 16.314 |
| Apr 2026 | 20 | 15 | 221.521 | 40.984 | +180.537 | 16.419 |
| Mei 2026 | 20 | 15 | 231.269 | 41.014 | +190.254 | 16.137 |
| Jun 2026 | 21 | 14 | 258.428 | 41.045 | +217.383 | 15.003 |

---

## BAGIAN 5 — DATA LENGKAP PER KABUPATEN/KOTA (Rata-rata Jan–Jun 2026)

Kolom: `prod_mean` = produksi ramalan rata-rata (ton/bln) · `sur_p50` = surplus P50 rata-rata (ton/bln) · `sur_p10` = surplus P10 (skenario buruk) · `def_rob` = defisit robust (ton/bln) · `sur_aman` = surplus aman (ton/bln) · `kirim` = total kirim 6 bln · `terima` = total terima 6 bln

### Banjarnegara

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 3.638 | +3.435 | +1.939 | 0 | 1.939 | 0 | 0 |
| Kacang Hijau | 7 | −21 | −28 | 28 | 0 | 0 | 0 |
| Kacang Tanah | 127 | +100 | −28 | 28 | 0 | 0 | 0 |
| Kedelai | 17 | −959 | −975 | 975 | 0 | 0 | 0 |
| Padi | 10.835 | −255 | −1.553 | 1.763 | 210 | 1.259 | 6.412 |
| Ubi Jalar | 186 | −72 | −251 | 251 | 0 | 0 | 0 |
| Ubi Kayu | 7.888 | +6.610 | +1.977 | 0 | 1.977 | 11.865 | 0 |

### Banyumas

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 2.534 | +2.421 | +1.446 | 0 | 1.446 | 0 | 0 |
| Kacang Hijau | 9 | −71 | −80 | 80 | 0 | 0 | 0 |
| Kacang Tanah | 152 | +88 | −64 | 64 | 0 | 0 | 0 |
| Kedelai | 12 | −1.468 | −1.480 | 1.480 | 0 | 0 | 0 |
| Padi | 27.642 | +2.413 | −783 | 3.257 | 2.474 | 3.323 | 13.537 |
| Ubi Jalar | 204 | −391 | −595 | 595 | 0 | 0 | 0 |
| Ubi Kayu | 2.565 | +635 | −641 | 641 | 0 | 0 | 3.843 |

### Batang

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 9.630 | +9.616 | +6.610 | 0 | 6.610 | 0 | 0 |
| Kacang Hijau | 12 | −24 | −37 | 37 | 0 | 0 | 0 |
| Kacang Tanah | 19 | −3 | −22 | 22 | 0 | 0 | 0 |
| Kedelai | 18 | −779 | −797 | 797 | 0 | 0 | 0 |
| Padi | 16.970 | +3.434 | +1.572 | 568 | 2.140 | 9.211 | 1.106 |
| Ubi Jalar | 626 | +384 | −241 | 241 | 0 | 0 | 0 |
| Ubi Kayu | 2.628 | +1.582 | +412 | 10 | 422 | 2.531 | 59 |

### Blora

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 47.157 | +47.055 | +30.146 | 0 | 30.146 | 0 | 0 |
| Kacang Hijau | 155 | +147 | −8 | 8 | 0 | 0 | 0 |
| Kacang Tanah | 173 | +117 | −55 | 55 | 0 | 0 | 0 |
| Kedelai | 334 | −374 | −708 | 708 | 0 | 0 | 0 |
| Padi | 53.174 | +23.839 | +17.718 | 0 | 17.718 | 10.882 | 0 |
| Ubi Jalar | 21 | −184 | −205 | 205 | 0 | 0 | 0 |
| Ubi Kayu | 952 | +204 | −623 | 623 | 0 | 0 | 3.736 |

### Boyolali

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 20.574 | +20.546 | +14.321 | 0 | 14.321 | 0 | 0 |
| Kacang Hijau | 2 | −17 | −19 | 19 | 0 | 0 | 0 |
| Kacang Tanah | 222 | +193 | −29 | 29 | 0 | 0 | 0 |
| Kedelai | 31 | −973 | −1.003 | 1.003 | 0 | 0 | 0 |
| Padi | 25.947 | +7.895 | +5.059 | 991 | 6.051 | 3.281 | 2.731 |
| Ubi Jalar | 18 | −250 | −268 | 268 | 0 | 0 | 0 |
| Ubi Kayu | 4.243 | +2.972 | +272 | 16 | 289 | 1.596 | 98 |

### Brebes

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 15.084 | +15.011 | +9.597 | 0 | 9.597 | 0 | 0 |
| Kacang Hijau | 598 | +508 | −90 | 90 | 0 | 0 | 0 |
| Kacang Tanah | 2 | −52 | −54 | 54 | 0 | 0 | 0 |
| Kedelai | 299 | −1.737 | −2.036 | 2.036 | 0 | 0 | 0 |
| Padi | 38.644 | +5.416 | +563 | 3.983 | 4.546 | 2.493 | 12.672 |
| Ubi Jalar | 382 | −15 | −386 | 386 | 0 | 0 | 0 |
| Ubi Kayu | 842 | −582 | −1.253 | 1.253 | 0 | 0 | 7.518 |

### Cilacap

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 5.271 | +5.200 | +3.280 | 0 | 3.280 | 0 | 0 |
| Kacang Hijau | 702 | +667 | −35 | 35 | 0 | 0 | 0 |
| Kacang Tanah | 273 | +237 | −35 | 35 | 0 | 0 | 0 |
| Kedelai | 832 | −508 | −1.340 | 1.340 | 0 | 0 | 0 |
| **Padi** | **83.497** | **+32.712** | **+22.891** | 0 | 22.891 | **33.347** | 0 |
| Ubi Jalar | 492 | +175 | −317 | 317 | 0 | 0 | 0 |
| Ubi Kayu | 4.775 | +3.241 | +84 | 111 | 194 | 1.164 | 663 |

### Demak

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 8.082 | +8.038 | +4.697 | 0 | 4.697 | 0 | 0 |
| Kacang Hijau | 1.454 | +1.410 | −44 | 44 | 0 | 0 | 0 |
| Kacang Tanah | 28 | −15 | −32 | 32 | 0 | 0 | 0 |
| Kedelai | 69 | −1.065 | −1.135 | 1.135 | 0 | 0 | 0 |
| Padi | 48.198 | +18.635 | +12.318 | 433 | 12.751 | 29.794 | 1.216 |
| Ubi Jalar | 519 | +104 | −262 | 262 | 0 | 0 | 0 |
| Ubi Kayu | 309 | −1.087 | −1.147 | 1.147 | 0 | 0 | 6.879 |

### Grobogan

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| **Jagung** | **77.185** | **+77.094** | **+50.565** | 0 | 50.565 | 0 | 0 |
| Kacang Hijau | 698 | +672 | −26 | 26 | 0 | 0 | 0 |
| Kacang Tanah | 3 | −63 | −65 | 65 | 0 | 0 | 0 |
| Kedelai | 1.827 | +478 | −1.349 | 1.349 | 0 | 0 | 0 |
| Padi | 59.645 | +22.643 | +14.998 | 635 | 15.633 | 0 | 3.088 |
| Ubi Jalar | 24 | −330 | −354 | 354 | 0 | 0 | 0 |
| Ubi Kayu | 326 | −1.351 | −1.545 | 1.545 | 0 | 0 | 9.273 |

### Jepara

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 6.136 | +6.104 | +3.900 | 0 | 3.900 | 0 | 0 |
| Kacang Hijau | 12 | −20 | −30 | 30 | 0 | 0 | 0 |
| Kacang Tanah | 614 | +582 | −32 | 32 | 0 | 0 | 0 |
| Kedelai | 16 | −1.112 | −1.120 | 1.120 | 0 | 0 | 0 |
| Padi | 18.843 | +1.962 | −237 | 2.183 | 1.947 | 0 | 6.908 |
| Ubi Jalar | 36 | −308 | −342 | 342 | 0 | 0 | 0 |
| **Ubi Kayu** | **18.587** | **+17.052** | **+8.045** | 0 | 8.045 | **24.722** | 0 |

### Karanganyar

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 2.274 | +2.249 | +1.440 | 0 | 1.440 | 0 | 0 |
| Kacang Hijau | 9 | −16 | −25 | 25 | 0 | 0 | 0 |
| Kacang Tanah | 234 | +192 | −42 | 42 | 0 | 0 | 0 |
| Kedelai | 17 | −1.183 | −1.200 | 1.200 | 0 | 0 | 0 |
| Padi | 29.857 | +9.570 | +6.199 | 45 | 6.243 | 10.157 | 267 |
| Ubi Jalar | 1.991 | +1.441 | −467 | 467 | 0 | 0 | 0 |
| Ubi Kayu | 5.859 | +4.009 | +1.328 | 0 | 1.328 | 7.488 | 0 |

### Kebumen

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 2.672 | +2.610 | +1.521 | 0 | 1.521 | 0 | 0 |
| Kacang Hijau | 481 | +456 | −25 | 25 | 0 | 0 | 0 |
| Kacang Tanah | 124 | +74 | −49 | 49 | 0 | 0 | 0 |
| Kedelai | 17 | −1.467 | −1.484 | 1.484 | 0 | 0 | 0 |
| Padi | 42.121 | +14.116 | +9.438 | 603 | 10.040 | 7.776 | 0 |
| Ubi Jalar | 31 | −303 | −334 | 334 | 0 | 0 | 0 |
| Ubi Kayu | 2.415 | +758 | −566 | 566 | 0 | 0 | 3.396 |

### Kendal

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 18.203 | +18.138 | +11.621 | 0 | 11.621 | 0 | 0 |
| Kacang Hijau | 37 | +9 | −28 | 28 | 0 | 0 | 0 |
| Kacang Tanah | 10 | −27 | −37 | 37 | 0 | 0 | 0 |
| Kedelai | 41 | −972 | −1.013 | 1.013 | 0 | 0 | 0 |
| Padi | 15.102 | +600 | −1.180 | 2.694 | 1.514 | 9.083 | 10.281 |
| Ubi Jalar | 577 | +159 | −398 | 398 | 0 | 0 | 0 |
| Ubi Kayu | 458 | −1.086 | −1.357 | 1.357 | 0 | 0 | 8.144 |

### Klaten

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 7.183 | +7.149 | +4.313 | 0 | 4.313 | 0 | 0 |
| Kacang Hijau | 48 | +14 | −34 | 34 | 0 | 0 | 0 |
| Kacang Tanah | 96 | +51 | −45 | 45 | 0 | 0 | 0 |
| Kedelai | 145 | −929 | −1.074 | 1.074 | 0 | 0 | 0 |
| Padi | 38.827 | +12.835 | +8.383 | 72 | 8.455 | 11.531 | 0 |
| Ubi Jalar | 447 | +145 | −234 | 234 | 0 | 0 | 0 |
| Ubi Kayu | 1.863 | +453 | −522 | 522 | 0 | 0 | 3.134 |

### Kota Magelang

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 6 | −3 | −3 | 3 | 0 | 0 | 120 |
| Kacang Hijau | 2 | −1 | −3 | 3 | 0 | 0 | 0 |
| Kacang Tanah | 2 | 0 | −1 | 1 | 0 | 0 | 0 |
| Kedelai | 6 | −79 | −85 | 85 | 0 | 0 | 0 |
| Padi | 60 | −610 | −618 | 618 | 0 | 0 | 3.069 |
| Ubi Jalar | 6 | −7 | −8 | 8 | 0 | 0 | 0 |
| Ubi Kayu | 5 | −94 | −95 | 95 | 0 | 0 | 568 |

### Kota Pekalongan

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 7 | +1 | +1 | 1 | 1 | 0 | 20 |
| Kacang Hijau | 2 | −12 | −14 | 14 | 0 | 0 | 0 |
| Kacang Tanah | 2 | −4 | −5 | 5 | 0 | 0 | 0 |
| Kedelai | 5 | −306 | −311 | 311 | 0 | 0 | 0 |
| **Padi** | **865** | **−1.806** | **−1.907** | 1.907 | 0 | 0 | **9.339** |
| Ubi Jalar | 5 | −48 | −49 | 49 | 0 | 0 | 0 |
| Ubi Kayu | 17 | −211 | −217 | 217 | 0 | 0 | 1.305 |

### Kota Salatiga

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 12 | −6 | −11 | 11 | 0 | 0 | 120 |
| Kacang Hijau | 2 | −3 | −5 | 5 | 0 | 0 | 0 |
| Kacang Tanah | 2 | −1 | −3 | 3 | 0 | 0 | 0 |
| Kedelai | 6 | −161 | −167 | 167 | 0 | 0 | 0 |
| Padi | 321 | −1.025 | −1.065 | 1.065 | 0 | 0 | 5.237 |
| Ubi Jalar | 14 | −44 | −56 | 56 | 0 | 0 | 0 |
| Ubi Kayu | 114 | −122 | −178 | 178 | 0 | 0 | 1.070 |

### Kota Semarang

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 217 | +83 | +10 | 19 | 28 | 0 | 118 |
| Kacang Hijau | 20 | −24 | −34 | 34 | 0 | 0 | 0 |
| Kacang Tanah | 23 | −22 | −29 | 29 | 0 | 0 | 0 |
| Kedelai | 29 | −1.367 | −1.373 | 1.373 | 0 | 0 | 0 |
| **Padi** | **1.434** | **−9.517** | **−9.706** | **9.706** | 0 | 0 | **48.141** |
| Ubi Jalar | 55 | −302 | −325 | 325 | 0 | 0 | 0 |
| Ubi Kayu | 198 | −1.510 | −1.597 | 1.597 | 0 | 0 | 9.584 |

> Kota Semarang: defisit padi terbesar se-Jateng (−9.706 ton/bln skenario buruk), menerima 48.141 ton dari wilayah surplus selama 6 bulan.

### Kota Surakarta

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 5 | −18 | −19 | 19 | 0 | 0 | 121 |
| Kacang Hijau | 2 | −25 | −27 | 27 | 0 | 0 | 0 |
| Kacang Tanah | 2 | −11 | −13 | 13 | 0 | 0 | 0 |
| Kedelai | 6 | −430 | −435 | 435 | 0 | 0 | 0 |
| Padi | 17 | −3.322 | −3.325 | 3.325 | 0 | 0 | 19.703 |
| Ubi Jalar | 6 | −89 | −90 | 90 | 0 | 0 | 0 |
| Ubi Kayu | 7 | −493 | −493 | 493 | 0 | 0 | 2.958 |

### Kota Tegal

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 4 | −3 | −4 | 4 | 0 | 0 | 120 |
| Kacang Hijau | 2 | −16 | −17 | 17 | 0 | 0 | 0 |
| Kacang Tanah | 2 | −6 | −7 | 7 | 0 | 0 | 0 |
| Kedelai | 5 | −234 | −239 | 239 | 0 | 0 | 0 |
| Padi | 304 | −2.132 | −2.167 | 2.167 | 0 | 0 | 10.745 |
| Ubi Jalar | 5 | −72 | −73 | 73 | 0 | 0 | 0 |
| Ubi Kayu | 7 | −125 | −125 | 125 | 0 | 0 | 752 |

### Kudus

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 1.365 | +1.326 | +704 | 0 | 704 | 0 | 0 |
| Kacang Hijau | 296 | +281 | −15 | 15 | 0 | 0 | 0 |
| Kacang Tanah | 9 | −22 | −31 | 31 | 0 | 0 | 0 |
| Kedelai | 13 | −726 | −739 | 739 | 0 | 0 | 0 |
| Padi | 18.150 | +4.606 | +2.360 | 377 | 2.737 | 6.892 | 728 |
| Ubi Jalar | 100 | −62 | −162 | 162 | 0 | 0 | 0 |
| Ubi Kayu | 1.973 | +1.173 | +4 | 56 | 60 | 354 | 348 |

### Magelang

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 1.942 | +1.872 | +991 | 0 | 991 | 120 | 0 |
| Kacang Hijau | 6 | −17 | −23 | 23 | 0 | 0 | 0 |
| Kacang Tanah | 36 | +13 | −23 | 23 | 0 | 0 | 0 |
| Kedelai | 10 | −1.004 | −1.009 | 1.009 | 0 | 0 | 0 |
| Padi | 15.972 | +1.105 | −803 | 2.139 | 1.336 | 7.904 | 7.190 |
| Ubi Jalar | 1.202 | +934 | −268 | 268 | 0 | 0 | 0 |
| Ubi Kayu | 2.164 | +650 | −506 | 506 | 0 | 0 | 3.039 |

### Pati

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 14.284 | +14.236 | +8.970 | 0 | 8.970 | 0 | 0 |
| Kacang Hijau | 622 | +574 | −48 | 48 | 0 | 0 | 0 |
| Kacang Tanah | 83 | +48 | −36 | 36 | 0 | 0 | 0 |
| Kedelai | 152 | −824 | −976 | 976 | 0 | 0 | 0 |
| Padi | 45.041 | +15.664 | +9.991 | 884 | 10.875 | 728 | 5.305 |
| Ubi Jalar | 221 | −208 | −429 | 429 | 0 | 0 | 0 |
| **Ubi Kayu** | **42.115** | **+40.364** | **+21.099** | 0 | 21.099 | **20.717** | 0 |

### Pekalongan

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 1.077 | +1.041 | +618 | 0 | 618 | 20 | 0 |
| Kacang Hijau | 12 | −24 | −36 | 36 | 0 | 0 | 0 |
| Kacang Tanah | 14 | −13 | −27 | 27 | 0 | 0 | 0 |
| Kedelai | 12 | −1.003 | −1.015 | 1.015 | 0 | 0 | 0 |
| Padi | 15.825 | +1.684 | −310 | 1.849 | 1.540 | 4.066 | 6.230 |
| Ubi Jalar | 136 | −184 | −320 | 320 | 0 | 0 | 0 |
| Ubi Kayu | 715 | −326 | −597 | 597 | 0 | 0 | 3.581 |

### Pemalang

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 5.708 | +5.533 | +3.468 | 0 | 3.468 | 0 | 0 |
| Kacang Hijau | 15 | −39 | −53 | 53 | 0 | 0 | 0 |
| Kacang Tanah | 19 | −49 | −62 | 62 | 0 | 0 | 0 |
| Kedelai | 129 | −1.662 | −1.791 | 1.791 | 0 | 0 | 0 |
| Padi | 36.278 | +9.052 | +4.955 | 2.444 | 7.399 | 9.581 | 7.812 |
| Ubi Jalar | 167 | −345 | −512 | 512 | 0 | 0 | 0 |
| Ubi Kayu | 190 | −1.641 | −1.722 | 1.722 | 0 | 0 | 10.333 |

### Purbalingga

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 3.993 | +3.902 | +2.372 | 0 | 2.372 | 0 | 0 |
| Kacang Hijau | 11 | −43 | −54 | 54 | 0 | 0 | 0 |
| Kacang Tanah | 26 | −10 | −36 | 36 | 0 | 0 | 0 |
| Kedelai | 23 | −1.006 | −1.030 | 1.030 | 0 | 0 | 0 |
| Padi | 12.148 | −1 | −1.557 | 2.409 | 853 | 0 | 9.391 |
| Ubi Jalar | 407 | +100 | −301 | 301 | 0 | 0 | 0 |
| Ubi Kayu | 3.393 | +2.400 | +753 | 0 | 753 | 4.518 | 0 |

### Purworejo

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 743 | +708 | +309 | 0 | 309 | 0 | 0 |
| Kacang Hijau | 207 | +193 | −14 | 14 | 0 | 0 | 0 |
| Kacang Tanah | 46 | +25 | −21 | 21 | 0 | 0 | 0 |
| Kedelai | 7 | −712 | −718 | 718 | 0 | 0 | 0 |
| Padi | 26.862 | +10.085 | +7.101 | 323 | 7.423 | 12.149 | 807 |
| Ubi Jalar | 80 | −148 | −228 | 228 | 0 | 0 | 0 |
| Ubi Kayu | 1.200 | +420 | −507 | 507 | 0 | 0 | 3.042 |

### Rembang

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 14.681 | +14.577 | +9.191 | 0 | 9.191 | 0 | 0 |
| Kacang Hijau | 72 | +55 | −17 | 17 | 0 | 0 | 0 |
| Kacang Tanah | 19 | −4 | −23 | 23 | 0 | 0 | 0 |
| Kedelai | 49 | −569 | −618 | 618 | 0 | 0 | 0 |
| Padi | 20.974 | +6.843 | +4.692 | 334 | 5.026 | 0 | 2.003 |
| Ubi Jalar | 155 | +17 | −139 | 139 | 0 | 0 | 0 |
| Ubi Kayu | 2.980 | +2.450 | +97 | 46 | 143 | 859 | 277 |

### Semarang (Kab.)

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 6.628 | +6.571 | +4.079 | 0 | 4.079 | 238 | 0 |
| Kacang Hijau | 21 | +12 | +1 | 1 | 1 | 0 | 0 |
| Kacang Tanah | 104 | +85 | −19 | 19 | 0 | 0 | 0 |
| Kedelai | 30 | −1.087 | −1.117 | 1.117 | 0 | 0 | 0 |
| Padi | 17.105 | +2.829 | +948 | 874 | 1.822 | 10.933 | 2.074 |
| Ubi Jalar | 1.559 | +1.152 | −407 | 407 | 0 | 0 | 0 |
| Ubi Kayu | 3.372 | +1.877 | +341 | 7 | 348 | 2.088 | 39 |

### Sragen

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 16.058 | +16.031 | +10.496 | 0 | 10.496 | 0 | 0 |
| Kacang Hijau | 4 | −31 | −35 | 35 | 0 | 0 | 0 |
| Kacang Tanah | 459 | +424 | −35 | 35 | 0 | 0 | 0 |
| Kedelai | 87 | −1.053 | −1.140 | 1.140 | 0 | 0 | 0 |
| **Padi** | **57.349** | **+25.525** | **+17.975** | 0 | 17.975 | **11.357** | 0 |
| Ubi Jalar | 16 | −367 | −376 | 376 | 0 | 0 | 0 |
| Ubi Kayu | 426 | −636 | −1.047 | 1.047 | 0 | 0 | 6.285 |

### Sukoharjo

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 1.149 | +1.116 | +643 | 0 | 643 | 121 | 0 |
| Kacang Hijau | 5 | −28 | −33 | 33 | 0 | 0 | 0 |
| Kacang Tanah | 193 | +111 | −82 | 82 | 0 | 0 | 0 |
| Kedelai | 140 | −810 | −951 | 951 | 0 | 0 | 0 |
| Padi | 35.453 | +14.075 | +10.262 | 45 | 10.307 | 16.365 | 0 |
| Ubi Jalar | 38 | −274 | −298 | 298 | 0 | 0 | 0 |
| Ubi Kayu | 919 | +42 | −628 | 628 | 0 | 0 | 3.769 |

### Tegal (Kab.)

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 11.874 | +11.801 | +7.103 | 0 | 7.103 | 120 | 0 |
| Kacang Hijau | 10 | −34 | −44 | 44 | 0 | 0 | 0 |
| Kacang Tanah | 26 | −4 | −29 | 29 | 0 | 0 | 0 |
| Kedelai | 19 | −1.532 | −1.551 | 1.551 | 0 | 0 | 0 |
| Padi | 35.909 | +7.490 | +3.335 | 1.393 | 4.728 | 17.150 | 2.875 |
| Ubi Jalar | 633 | +194 | −439 | 439 | 0 | 0 | 0 |
| Ubi Kayu | 663 | −756 | −1.169 | 1.169 | 0 | 0 | 7.016 |

### Temanggung

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 4.165 | +4.137 | +2.393 | 0 | 2.393 | 0 | 0 |
| Kacang Hijau | 6 | −8 | −14 | 14 | 0 | 0 | 0 |
| Kacang Tanah | 19 | +12 | −7 | 7 | 0 | 0 | 0 |
| Kedelai | 13 | −624 | −636 | 636 | 0 | 0 | 0 |
| Padi | 5.211 | −2.272 | −2.941 | 2.941 | 0 | 0 | 13.279 |
| Ubi Jalar | 209 | +81 | −127 | 127 | 0 | 0 | 0 |
| Ubi Kayu | 633 | −109 | −477 | 477 | 0 | 0 | 2.861 |

### Wonogiri

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 24.492 | +24.383 | +14.966 | 0 | 14.966 | 0 | 0 |
| Kacang Hijau | 21 | +2 | −18 | 18 | 0 | 0 | 0 |
| Kacang Tanah | 2.427 | +2.364 | −63 | 63 | 0 | 0 | 0 |
| Kedelai | 128 | −1.022 | −1.151 | 1.151 | 0 | 0 | 0 |
| Padi | 33.580 | +11.360 | +7.488 | 1.025 | 8.513 | 0 | 2.756 |
| Ubi Jalar | 424 | −2 | −384 | 384 | 0 | 0 | 0 |
| **Ubi Kayu** | **78.756** | **+77.098** | **+39.552** | 0 | 39.552 | **13.680** | 0 |

### Wonosobo

| Komoditas | prod_mean | sur_p50 | sur_p10 | def_rob | sur_aman | kirim | terima |
|-----------|---:|---:|---:|---:|---:|---:|---:|
| Jagung | 5.775 | +5.550 | +3.222 | 0 | 3.222 | 0 | 0 |
| Kacang Hijau | 12 | +4 | −6 | 6 | 0 | 0 | 0 |
| Kacang Tanah | 35 | +19 | −16 | 16 | 0 | 0 | 0 |
| Kedelai | 23 | −885 | −908 | 908 | 0 | 0 | 0 |
| Padi | 6.534 | −2.348 | −3.166 | 3.166 | 0 | 0 | 14.361 |
| Ubi Jalar | 1.619 | +1.314 | −306 | 306 | 0 | 0 | 0 |
| Ubi Kayu | 8.164 | +6.894 | +2.034 | 0 | 2.034 | 11.989 | 0 |

---

## BAGIAN 6 — RANKING REGIONAL (Rata-rata Surplus P50 semua komoditas, Jan–Jun 2026)

### Top 10 Surplus (Pemasok Utama)

| Rank | Kabupaten/Kota | Surplus P50 Rata-rata (ton/bln) |
|------|----------------|---:|
| 1 | **Wonogiri** | **+16.312** |
| 2 | **Grobogan** | **+14.163** |
| 3 | **Blora** | **+10.115** |
| 4 | **Pati** | **+9.979** |
| 5 | **Cilacap** | **+5.961** |
| 6 | Sragen | +5.511 |
| 7 | Klaten | +3.209 |
| 8 | Demak | +2.870 |
| 9 | Sukoharjo | +2.162 |
| 10 | Purworejo | +1.527 |

### Top 10 Defisit (Peminta Terbesar)

| Rank | Kabupaten/Kota | Surplus P50 Rata-rata (ton/bln) |
|------|----------------|---:|
| 1 | **Kota Semarang** | **−1.808** |
| 2 | **Kota Surakarta** | **−627** |
| 3 | **Kota Tegal** | **−370** |
| 4 | **Kota Pekalongan** | **−341** |
| 5 | **Kota Salatiga** | **−194** |
| 6 | Wonosobo | −186 |
| 7 | Temanggung | −138 |
| 8 | Kota Magelang | −115 |
| 9 | Brebes | −97 |
| 10 | Tegal | −80 |

---

## BAGIAN 7 — OPTIMASI DISTRIBUSI (MILP)

### 7.1 Formulasi

- **Jenis:** Mixed-Integer Linear Programming (Robust Transportation MILP + slack impor)
- **Fungsi tujuan:** Minimasi total biaya distribusi (tarif × jarak) + penalti impor luar-provinsi
- **Input neraca:** Kuantil P10/P50/P90 surplus dari SARIMAX / LightGBM+Conformal
- **Robust:** Menggunakan `surplus_p10` (skenario pesimistis) untuk menentukan kapasitas pasokan aman

### 7.2 Parameter

| Parameter | Nilai |
|-----------|-------|
| Tarif | **Rp 2.500/ton/km** |
| Pemenuhan minimum (α) | **1.0** (wajib penuh) |
| Jarak maks rute | **250 km** |
| Muatan minimum per rute (aktif) | **20 ton** (aktivasi biner) |
| Biaya impor luar-provinsi | **4× tarif × jarak maks = Rp 2.500.000/ton** |

### 7.3 Output MILP (Deploy Jan–Jun 2026)

| Metrik | Nilai |
|--------|-------|
| Rute aktif (kirim_keluar > 0) | **144 observasi** |
| Penerima pasokan (terima > 0) | **252 observasi** |
| Defisit robust kedelai (rata-rata) | **990,7 ton/kab/bln** |
| Defisit robust padi (rata-rata) | **3.212,5 ton/kab/bln** |
| Surplus aman jagung (rata-rata) | **7.086,2 ton/kab/bln** |
| Surplus aman padi (rata-rata) | **11.036,9 ton/kab/bln** |
| Surplus aman ubi kayu (rata-rata) | **7.037,9 ton/kab/bln** |

### 7.4 Rute Distribusi Terbesar (6 bulan kumulatif)

| Komoditas | Pengirim Terbesar | Volume (ton) | Penerima Terbesar | Volume (ton) |
|-----------|-------------------|---:|-------------------|----|
| Padi | Cilacap | 33.347 | Kota Semarang | 48.141 |
| Padi | Demak | 29.794 | Kota Surakarta | 19.703 |
| Ubi Kayu | Wonogiri | 13.680 | Kota Semarang | 9.584 |
| Ubi Kayu | Jepara | 24.722 | Pemalang | 10.333 |

---

## BAGIAN 8 — ARSITEKTUR PIPELINE LENGKAP

```
Dataset BPS (2019–2025)
35 kab/kota × 7 komoditas × 84 bulan = 20.580 obs
        │
        ▼ [Fase 1] Preprocessing & Disagregasi
  - Denton-Cholette: tahunan → bulanan
  - Anchoring spasial
  - Panel seimbang sempurna (0 missing, 0 duplikat)
        │
        ▼ [Fase 2] Feature Engineering (anti-leakage)
  - lag12, lag24, seasmean (dari train only)
  - month_sin/cos, flag panen raya/paceklik
  - Exog: curah hujan, populasi
        │
        ▼ [Fase 3] Peramalan Produksi
  - 9 model: Seasonal-naive → SARIMA → SARIMAX →
    XGBoost → LightGBM → CatBoost → Hybrid →
    DeepAR → LightGBM+Conformal
  - Evaluasi: MASE temporal 80/20
  - Deploy: LightGBM+Conformal (titik + interval)
  - MILP input: SARIMAX P10/P50/P90
        │
        ▼ Derivasi Neraca
  surplus = produksi × rendemen − konsumsi
        │
        ▼ [Fase 4] Robust MILP
  - Input: 35 kab × 7 kom × 6 bln kuantil surplus
  - Output: rute distribusi optimal (binary activation)
        │
        ▼ [Fase 5] Dashboard Data
  dashboard_data.csv — 1.470 baris, siap Streamlit
```

---

## BAGIAN 9 — ARTEFAK OUTPUT

| File | Isi | Baris |
|------|-----|------:|
| `dashboard_data.csv` | Data deploy lengkap per kab×kom×bln | 1.470 |
| `artefak_milp/ramalan_kuantil_SARIMAX_untuk_milp.csv` | Kuantil backtest SARIMAX | — |
| `artefak_milp/ramalan_kuantil_DeepAR_untuk_milp.csv` | Kuantil backtest DeepAR | — |
| `artefak_milp/ramalan_kuantil_deploy_untuk_milp.csv` | Kuantil deploy → input MILP masa depan | — |
| `artefak_milp/rekomendasi_distribusi_milp.csv` | Rute pengiriman backtest | — |
| `artefak_milp/ringkasan_milp_bulanan.csv` | Ringkasan per komoditas×bulan backtest | — |
| `artefak_milp/dashboard_rekomendasi.csv` | Rute distribusi deploy (masa depan) | — |
| `artefak_milp/dashboard_ringkasan.csv` | Ringkasan distribusi deploy | — |

---

## BAGIAN 10 — CATATAN METODOLOGIS

**Mengapa meramal produksi, bukan surplus langsung?**
Surplus = selisih dua besaran besar yang nilainya mendekati nol → bising. Produksi lebih stabil dan musiman → MASE lebih rendah, interval lebih bermakna.

**Mengapa tidak membuang outlier?**
21% outlier IQR bersifat substantif: Grobogan/Cilacap/Sragen surplus raksasa vs. kota tanpa lahan. Membuangnya menghilangkan sinyal terpenting untuk MILP.

**Mengapa Conformal Prediction untuk deploy?**
Distribution-free — cakupan interval terjamin tanpa asumsi normalitas/stasioneritas. Lebih robust saat musim/pola bergeser di luar training period (2019–2025).

**Mengapa MILP, bukan LP biasa?**
Aktivasi rute biner (min-load 20 ton) penting secara logistik: rute kecil tidak efisien operasional. MILP menghindari rekomendasi distribusi di bawah ambang ekonomis.

**Implikasi Gotong-Royong:**
Gradien surplus↔defisit yang konsisten membuktikan redistribusi lintas-wilayah secara prinsip dapat menutup defisit padi dan ubi kayu di kota-kota tanpa impor luar-provinsi — khususnya dari pemasok Wonogiri (ubi kayu), Cilacap/Sragen/Demak (padi), dan Grobogan/Blora (jagung).

---

*Dibuat dari: `dashboard_data.csv` + `Fase2_3_TFT_AgriGotongRoyong.ipynb` + `dataset_jateng_bulanan_2019_2025.xlsx`*
*Pipeline: Preprocessing → Feature Engineering → ML Forecasting → Conformal Interval → Robust MILP → Dashboard Streamlit*
