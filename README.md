# Multi-Dataset Human Action Recognition (YOLOv11)

An end-to-end computer vision pipeline designed to consolidate multiple public action recognition datasets into a unified 8-class taxonomy and train a **YOLOv11 Nano** object detection model.

---

## Project Features

* **Multi-Source Data Consolidation**: Merges and re-indexes classes across three distinct datasets (`Action(Stanford40)`, `Human-Action-Recognition`, and `sitting-standing-lyingv2`) using Roboflow[span_0](start_span)[span_0](end_span).
* **Standardized Taxonomy**: Maps 30 original subclass labels into 8 unified categories.
* **Stratified Split**: Automatically reshuffles and partitions pooled instances into an 80% Train / 10% Valid / 10% Test split using stratified sampling[span_1](start_span)[span_1](end_span).
* **YOLOv11 Training**: Fine-tunes Ultralytics `yolo11n.pt` on the consolidated multi-class target dataset[span_2](start_span)[span_2](end_span).

---

## Consolidated Class Taxonomy

| Class ID | Target Class | Mapped Original Classes |
| :--- | :--- | :--- |
| **0** | `fall` | Fall-Detected, falling, Fall_down, Nearly_fall |
| **1** | `sitting` | sitting, Sitting, Sit Down |
| **2** | `standing` | standing, Standing |
| **3** | `walking_running` | walking, Walking, Walking_on_Stairs, running, jumping |
| **4** | `lying` | lying, Lying_down, crawling |
| **5** | `phone_interaction` | phoning, texting_message, taking_photos |
| **6** | `desk_activity` | reading, writing_on_a_book, drinking, Drinking, smoking |
| **7** | `gestures` | applauding, waving_hands, looking_through_a_telescope |

---

## Dataset Statistics

After consolidation, remapping, and stratified re-splitting, the combined dataset distribution is as follows[span_3](start_span)[span_3](end_span):

| Class Name | Train | Valid | Test | **Total** |
| :--- | :---: | :---: | :---: | :---: |
| **fall** | 4,134 | 517 | 516 | **5,167** |
| **sitting** | 2,910 | 359 | 372 | **3,641** |
| **walking_running** | 2,262 | 278 | 269 | **2,809** |
| **standing** | 2,121 | 255 | 257 | **2,633** |
| **lying** | 920 | 112 | 114 | **1,146** |
| **desk_activity** | 798 | 101 | 100 | **999** |
| **gestures** | 559 | 73 | 69 | **701** |
| **phone_interaction** | 510 | 64 | 63 | **637** |
| **Total** | **14,214** | **1,759** | **1,759** | **17,733** |

---

## 🚀 Quickstart

### Prerequisites

Install the required Python packages:

```bash
pip install ultralytics roboflow pandas pyyaml scikit-learn
