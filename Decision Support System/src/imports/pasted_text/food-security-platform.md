Forecast → Food Balance → Optimization → Recommendation → Intervention

PROMPT FIGMA — Predictive & Prescriptive Food Security Platform for Central Java

(FULL ENTERPRISE DSS VERSION)
IDENTITAS PLATFORM

Nama:

Predictive & Prescriptive Food Security Platform for Central Java


Deskripsi:

Decision Support System untuk:

Peramalan produksi pangan
Analisis surplus–defisit
Optimasi distribusi antar-kabupaten
Simulasi skenario ketahanan pangan
Rekomendasi intervensi pemerintah

berbasis:

Temporal Fusion Transformer (TFT)
Quantile Forecasting (P10/P50/P90)
Robust Food Balance Analysis
Mixed Integer Linear Programming (MILP)
DATA RULES (WAJIB)

JANGAN GENERATE DATA SENDIRI.

Semua angka, kabupaten, komoditas, bulan, produksi, konsumsi, surplus, defisit, biaya distribusi, hasil optimasi, interval prediksi, dan ranking HARUS berasal dari file dataset yang diupload user.

Jika suatu nilai tidak tersedia:

Tampilkan:

N/A

bukan angka buatan.

Semua chart, KPI, tabel, ranking, insight, recommendation, map, scenario simulator, dan recommendation engine harus membaca langsung dari dataset user.

DESIGN DIRECTION

Gabungan:

Palantir Foundry
Microsoft Fabric
Bloomberg Terminal Modern
Databricks Lakehouse Monitoring
Government Command Center
Supply Chain Control Tower

Bukan:

Power BI
Canva
Landing Page
AdminLTE
Bootstrap Template
CANVAS

Desktop:

1920 x 1080

Grid:

12 Columns
Gutter 24 px
Margin 32 px
COLOR SYSTEM

Background

#F8F7F4

Surface

#FFFFFF

Border

#E8E5DD

Text

#262626

Primary

#0F6E56

Secondary

#2F8F73

Warning

#C28B2C

Risk

#D85A30

Critical

#C0392B

Info

#3B82F6
TYPOGRAPHY

Page Title

Source Serif Pro
40 px

Section

Inter SemiBold
20 px

Body

Inter Regular
14–16 px

Numbers

Inter Bold
GLOBAL LAYOUT

LEFT SIDEBAR

240 px

Menu:

Overview
Forecast Intelligence
Food Balance Analysis
Distribution Optimization
Regional Intelligence
Scenario Simulator
Recommendation Center
Data Explorer
Model Monitoring
About Project

Footer Sidebar:

Dataset Status
Last Updated
Data Quality Score
Model Version
Analysis Version
TOP COMMAND BAR

Kiri:

AGRI-GOTONGROYONG INTELLIGENCE

Subjudul:

Predictive & Prescriptive Food Security Platform

Kanan:

Commodity Selector
Forecast Month Selector
Executive View Toggle
Download Report
Share Analysis
User Profile
PAGE 1 — OVERVIEW COMMAND CENTER

Tujuan:

Menjawab:

Apa masalahnya?
Di mana masalahnya?
Seberapa besar dampaknya?
Apa rekomendasinya?
KPI BAR

8 KPI Cards

Semua angka dari dataset.

Contoh KPI:

Total Forecast Production
Total Forecast Consumption
Total Surplus
Total Deficit
Local Fulfillment Rate
Total Distribution Cost
Districts in Deficit
Districts in Surplus

Mini sparkline:

berdasarkan tren historis.

HERO SECTION
Food Security Map

Peta Jawa Tengah

Kabupaten:

Hijau

= surplus

Merah

= defisit

Ukuran bubble:

besar surplus/defisit

Distribution Flow Layer

Panah antar kabupaten

berdasarkan hasil MILP

Ketebalan:

proporsional tonase

Tooltip:

Origin
Destination
Commodity
Volume
Distance
Cost
Executive Insight Panel

AI Insight Engine

otomatis membaca dataset.

Format:

KEY FINDING

BUSINESS IMPACT

RECOMMENDED ACTION

CONFIDENCE LEVEL
PAGE 2 — FORECAST INTELLIGENCE

Fokus:

Peramalan produksi pangan.

Forecast Explorer

Filter:

Commodity
District
Forecast Horizon
Quantile Forecast

Tampilkan:

P10
P50
P90

dalam bentuk:

Confidence Ribbon Chart.

Forecast Reliability

Menampilkan:

Model
Version
Training Period
Forecast Horizon
Risk Classification

Kabupaten dikategorikan:

Safe
Watchlist
High Risk
Critical

berdasarkan probabilitas defisit.

PAGE 3 — FOOD BALANCE ANALYSIS

Menampilkan:

Produksi
Konsumsi
Surplus
Defisit

per kabupaten.

Food Balance Matrix

Heatmap:

District × Commodity

warna:

Surplus → Hijau

Defisit → Merah

Deficit Hotspot Ranking

Ranking otomatis:

kabupaten dengan defisit terbesar.

Surplus Source Ranking

Ranking otomatis:

kabupaten surplus terbesar.

PAGE 4 — DISTRIBUTION OPTIMIZATION

Halaman utama MILP.

Optimization Network

Visualisasi jaringan distribusi.

Node:

Kabupaten

Edge:

Pengiriman

Optimization Summary

KPI:

Total Distributed
Local Fulfillment
External Import Needed
Total Cost
Recommendation Routes

Data Grid Enterprise

Kolom:

Origin
Destination
Commodity
Volume
Distance
Cost

Search

Filter

Export

Bookmark

Pagination

Audit Log

Critical Alert Panel

Jika:

Total Deficit > Total Surplus

WAJIB tampil:

Food Security Alert
Local supply is insufficient.

Recommended Actions:

1. Import from neighboring provinces
2. Release government reserves
3. Activate emergency logistics scheme
4. Prioritize critical deficit districts

Severity:

Critical

warna merah.

PAGE 5 — REGIONAL INTELLIGENCE

Peta Jawa Tengah penuh.

Klik kabupaten:

muncul profile drawer.

Profile Drawer

Menampilkan:

Forecast Production
Consumption
Surplus
Deficit
Incoming Supply
Outgoing Supply
Net Balance
Risk Level
PAGE 6 — SCENARIO SIMULATOR

Ini halaman favorit juri.

Before → After Layout

3 kolom:

Current Scenario
Intervention Scenario
Projected Scenario

User dapat mengubah:

Production
Consumption
Transport Cost
Distribution Capacity
Safety Stock

Realtime Update:

Food Balance
Deficit
Distribution Cost
Import Need
Fulfillment Rate
PAGE 7 — RECOMMENDATION CENTER

Jangan berupa teks.

Gunakan Recommendation Cards.

Card Structure

Priority

Target Commodity

Target District

Expected Impact

Difficulty

Timeline

Cost

Status

Contoh:

HIGH PRIORITY

Target:
Kabupaten Defisit Tertinggi

Action:
Redistribute Surplus from Adjacent Districts

Expected Impact:
Increase Local Fulfillment

Timeline:
1–3 Months

Status:
Ready for Implementation
PAGE 8 — DATA EXPLORER

Mirip gambar yang kamu kirim.

Fitur:

Search

Advanced Filter

Column Visibility

Export CSV

Export Excel

Export PDF

Bookmark View

Save Query

Pinned Columns

Pagination

Audit Trail

Data Quality Indicator

Dataset Tabs

Historical Data (2019–2025)

Forecast Data

Food Balance Data

Optimization Result

Recommendation Result

Semua file CSV user harus terlihat dapat dieksplorasi dari sini.

PAGE 9 — MODEL MONITORING

Menampilkan pipeline AI.

Pipeline

Historical Dataset
↓
Feature Engineering
↓
Temporal Fusion Transformer
↓
P10 P50 P90 Forecast
↓
Food Balance Engine
↓
MILP Optimization
↓
Recommendation Engine

Monitoring Card

Model Version

Training Date

Forecast Horizon

Prediction Coverage

Data Quality
PAGE 10 — ABOUT PROJECT

Problem Statement

Research Objective

Methodology

System Architecture

Dataset Summary

Expected Impact

Team Information

Competition Information

PREMIUM ENTERPRISE FEATURES (WAJIB ADA DI SEMUA HALAMAN)

Tambahkan:

Last Updated Timestamp

Data Quality Score

Model Version

Analysis Version

Download Report

Share Analysis

Bookmark Insight

Full Screen View

Audit Trail
EMPTY STATE

Jika filter tidak menghasilkan data:

No matching records found.

Try:
• Broadening your filters
• Selecting another commodity
• Choosing a different forecast period
ANALYZING STATE

Saat tombol:

Run Optimization
Generate Recommendation
Recalculate Scenario

ditekan tampil:

Loading Forecast Data...

Running Food Balance Engine...

Solving MILP Optimization...

Validating Distribution Feasibility...

Generating Policy Recommendation...

Completed.

Ini akan menghasilkan dashboard yang terasa seperti Palantir untuk ketahanan pangan Jawa Tengah, bukan dashboard akademik biasa.