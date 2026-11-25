import os
import uuid

import streamlit as st
from PIL import Image

import backend

st.set_page_config(page_title="Closet Remix", layout="wide")


@st.cache_resource
def get_cached_model():
    return backend.load_segmentation_model()


# --- Sidebar Settings ---
with st.sidebar:
    st.header("Settings")
    gemini_key = st.text_input(
        "Gemini API Key (Optional)",
        type="password",
        help="Leave blank to run 100% offline with Ollama.",
    )
    ollama_model = st.text_input("Offline Ollama Model", value="qwen3-vl:4b")
    threshold = st.slider("RF-DETR Confidence Threshold", 0.15, 0.70, 0.25, 0.05)

    if os.path.exists(backend.MODEL_PATH):
        st.success("RF-DETR weights loaded")
    else:
        st.error(f"Missing `{backend.MODEL_PATH}` in this folder")


# --- Main UI ---
st.title("Closet Remix")
st.caption("Local RF-DETR Segmentation + Hybrid VLM Condition Check & Outfit Studio")

tab_add, tab_closet, tab_remix, tab_insights = st.tabs(
    ["1. Add Garment", "2. My Closet", "3. Outfit Studio", "4. Insights & History"]
)

# --- Tab 1: Upload, Segment & Analyze ---
with tab_add:
    uploaded_files = st.file_uploader(
        "Upload clothing photos",
        type=["jpg", "jpeg", "png"],
        accept_multiple_files=True,
    )

    if uploaded_files and st.button(f"Segment & Analyze ({len(uploaded_files)} photos)", type="primary"):
        get_cached_model()
        closet = backend.load_closet()
        progress = st.progress(0)

        for idx, uploaded in enumerate(uploaded_files):
            st.markdown(f"#### {uploaded.name}")
            orig_img = Image.open(uploaded)
            col1, col2 = st.columns(2)
            with col1:
                st.image(orig_img, caption="Original Photo", width="stretch")

            with st.spinner(f"Segmenting {uploaded.name}..."):
                cutout = backend.segment_garment(orig_img, threshold=threshold)

            if cutout is None:
                st.error(f"No garment detected in {uploaded.name}. Try lowering the confidence threshold.")
            else:
                item_id = f"item_{uuid.uuid4().hex[:6]}"
                cutout_path = str(backend.CUTOUT_DIR / f"{item_id}.png")
                cutout.save(cutout_path)

                with col2:
                    st.image(cutout, caption="Segmented Cutout", width="stretch")

                with st.spinner(f"Analyzing {uploaded.name} with VLM..."):
                    try:
                        info = backend.analyze_garment(cutout_path, gemini_key, ollama_model)
                        if info.get("warning"):
                            st.toast(info["warning"])
                        record = {"id": item_id, "image_path": cutout_path, **info}
                        closet.append(record)
                        backend.save_closet(closet)

                        st.success(f"Saved as **{info['item_name']}** ({info['category']}) via {info['source']}")
                        st.info(f"**Condition:** `{info['condition'].upper()}` — {info['condition_note']}")
                    except Exception as e:
                        st.error(f"VLM analysis failed for {uploaded.name}: {e}")

            progress.progress((idx + 1) / len(uploaded_files))
            st.divider()

# --- Tab 2: Digital Closet ---
with tab_closet:
    closet = backend.load_closet()
    if not closet:
        st.info("Your closet is empty. Upload garments in the first tab.")
    else:
        cols = st.columns(4)
        for idx, item in enumerate(closet):
            with cols[idx % 4]:
                if os.path.exists(item["image_path"]):
                    st.image(item["image_path"], width="stretch")
                st.markdown(f"**{item['item_name']}**")
                st.caption(f"{item['category']} • {item['primary_color']} • {item['style']}")
                cond = item["condition"]
                if cond == "good":
                    st.success(f"Condition: {cond}")
                elif cond == "wrinkled":
                    st.warning(f"Condition: {cond}")
                else:
                    st.error(f"Condition: {cond}")

                if st.button("Remove", key=f"del_{item['id']}"):
                    closet = [c for c in closet if c["id"] != item["id"]]
                    backend.save_closet(closet)
                    st.rerun()

# --- Tab 3: Outfit Studio ---
with tab_remix:
    closet = backend.load_closet()
    c1, c2, c3 = st.columns(3)
    with c1:
        occasion = st.selectbox(
            "Where are you headed?",
            ["Casual college day", "Formal / presentation", "Evening hangout", "Sporty / active"],
            key="remix_occasion",
        )
    with c2:
        weather = st.selectbox(
            "Weather / Season",
            ["Spring / Mild", "Summer / Hot", "Winter / Cold", "Rainy / Monsoon"],
            key="remix_weather",
        )
    with c3:
        style_pref = st.selectbox(
            "Style preference",
            list(backend.STYLE_PREFERENCE_HINTS.keys()),
            key="remix_style",
        )

    if st.button("Generate Outfit Pairing", type="primary", key="btn_generate"):
        last_ids = st.session_state.get("current_outfit", {}).get("selected_ids", [])
        with st.spinner("Styling your outfit..."):
            res = backend.suggest_outfit(
                closet,
                occasion=occasion,
                weather=weather,
                style_preference=style_pref,
                gemini_key=gemini_key,
                ollama_model=ollama_model,
                last_ids=last_ids,
            )
            if res.get("warning"):
                st.toast(res["warning"])
            st.session_state["current_outfit"] = res

    suggestion = st.session_state.get("current_outfit")
    if suggestion:
        selected = [c for c in closet if c["id"] in suggestion["selected_ids"]]
        if not selected:
            st.warning(suggestion["why_it_works"])
        else:
            st.subheader(
                f"{suggestion.get('outfit_title', 'Suggested Outfit')}  "
                f"({suggestion.get('source', '')} • {suggestion.get('mode', '')} Mode)"
            )
            if suggestion.get("tagline"):
                st.caption(suggestion["tagline"])

            out_cols = st.columns(len(selected))
            for col, item in zip(out_cols, selected):
                with col:
                    st.image(item["image_path"], width="stretch")
                    st.markdown(f"**{item['item_name']}**")
                    st.caption(f"{item['category']} • {item['style']} • {item['condition']}")

            st.info(f"**Why this works:** {suggestion.get('why_it_works', '')}")

            b1, b2, b3, _ = st.columns([1.2, 1.2, 1.2, 3])
            with b1:
                if st.button("👍 Wear / Like", key="btn_like"):
                    backend.record_wear_and_like(suggestion, occasion)
                    st.success("Logged to history & preferences!")
            with b2:
                if st.button("💾 Save Outfit", key="btn_save"):
                    backend.save_outfit_to_favorites(suggestion, occasion)
                    st.success("Saved to Saved Outfits!")
            with b3:
                if st.button("👎 Dislike Pair", key="btn_dislike"):
                    backend.record_dislike(suggestion["selected_ids"])
                    st.info("Got it—we'll avoid this exact combination.")

# --- Tab 4: Insights & History Preview (mirrors your teammate's UI data) ---
with tab_insights:
    insights = backend.get_wardrobe_insights()
    st.subheader("Wardrobe Mix")
    mix_cols = st.columns(5)
    for col, (cat, stats) in zip(mix_cols, insights["wardrobe_mix"].items()):
        col.metric(cat, f"{stats['percent']}%", f"{stats['count']} items")

    st.divider()
    col_most, col_over = st.columns(2)
    with col_most:
        st.markdown("#### Most Worn Pieces")
        if not insights["most_worn"]:
            st.caption("No outfits logged yet. Click 'Wear / Like' in Outfit Studio.")
        for item in insights["most_worn"]:
            st.write(f"- **{item['item_name']}** ({item['category']})")

    with col_over:
        st.markdown("#### Still Waiting for Their Moment")
        for item in insights["overlooked"][:6]:
            st.write(f"- **{item['item_name']}** ({item['category']})")