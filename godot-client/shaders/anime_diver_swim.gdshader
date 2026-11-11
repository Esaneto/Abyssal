shader_type canvas_item;
render_mode unshaded, blend_mix;

// Photo-fidelity is preserved: all default uniforms leave texture RGB unchanged.
// A dense 36x28 deformable mesh animates fins and hair independently of collisions.
uniform float swim_time = 0.0;
uniform float motion : hint_range(0.0, 1.0) = 0.3;
uniform float is_female : hint_range(0.0, 1.0) = 1.0;
uniform float hair_change : hint_range(0.0, 1.0) = 0.0;
uniform vec4 hair_color : source_color = vec4(0.82, 0.48, 0.30, 1.0);
uniform vec4 suit_color : source_color = vec4(0.25, 0.58, 0.95, 1.0);
uniform float suit_mix : hint_range(0.0, 1.0) = 0.0;
uniform float detail_glow : hint_range(0.0, 1.0) = 0.2;

float in_band(float v, float low0, float low1, float high0, float high1) {
    return smoothstep(low0, low1, v) * (1.0 - smoothstep(high0, high1, v));
}

void vertex() {
    float hair_female = in_band(UV.x, 0.19, 0.39, 0.69, 0.87) *
        in_band(UV.y, 0.05, 0.12, 0.35, 0.49);
    float hair_male = in_band(UV.x, 0.62, 0.70, 0.83, 0.94) *
        in_band(UV.y, 0.07, 0.13, 0.28, 0.41);
    float hair = mix(hair_male, hair_female, is_female);
    float fins = (1.0 - smoothstep(0.19, 0.43, UV.x)) *
        smoothstep(0.42, 0.67, UV.y);
    // Legs alternate as two waves, keeping the torso and face stable.
    float fin_phase = UV.y > 0.73 ? 1.4 : 0.0;
    VERTEX.y += sin(swim_time * 4.2 + UV.x * 5.6 + fin_phase) *
        fins * (3.3 + motion * 9.0);
    VERTEX.x += sin(swim_time * 2.4 + UV.x * 8.0) *
        hair * (1.1 + motion * 2.0);
    VERTEX.y += cos(swim_time * 2.1 + UV.x * 6.0) *
        hair * (0.7 + motion * 2.1);
    // Breath and tiny shoulder motion, preserving proportions.
    float torso = in_band(UV.x, 0.49, 0.58, 0.73, 0.85) *
        in_band(UV.y, 0.33, 0.41, 0.69, 0.77);
    VERTEX.y += sin(swim_time * 1.47) * torso * 0.8;
}

void fragment() {
    vec4 px = texture(TEXTURE, UV) * COLOR;
    if (px.a <= 0.001) {
        COLOR = px;
    } else {
        vec3 raw = px.rgb;
        float female_hair = in_band(UV.x, 0.18, 0.28, 0.70, 0.85) *
            in_band(UV.y, 0.05, 0.11, 0.36, 0.46) *
            smoothstep(0.05, 0.18, raw.r - raw.b);
        float male_hair = in_band(UV.x, 0.65, 0.71, 0.80, 0.88) *
            in_band(UV.y, 0.10, 0.18, 0.30, 0.38) *
            (1.0 - smoothstep(0.25, 0.70, dot(raw, vec3(0.299,0.587,0.114))));
        float hair_region = mix(male_hair, female_hair, is_female);
        float lum = dot(raw, vec3(0.24, 0.64, 0.12));
        vec3 recolored = hair_color.rgb * (0.25 + 1.35 * lum);
        px.rgb = mix(px.rgb, recolored, hair_region * hair_change * 0.67);
        // Recolor dark neoprene gently; retain real reflections, face and lights.
        float suit_area = in_band(UV.x, 0.21, 0.35, 0.78, 0.94) *
            in_band(UV.y, 0.29, 0.41, 0.87, 0.99);
        float blue_cloth = smoothstep(0.025, 0.16, raw.b - raw.r) *
            (1.0 - smoothstep(0.42, 0.90, lum));
        px.rgb = mix(px.rgb,
            px.rgb * (0.50 + suit_color.rgb * 0.90),
            suit_area * blue_cloth * suit_mix);
        // Subtle cyan rim enhancement lives on the luminous suit itself.
        float cyan = smoothstep(0.03, 0.24, raw.g - raw.r) *
            smoothstep(0.35, 0.72, raw.b);
        px.rgb += cyan * detail_glow * 0.026;
        COLOR = px;
    }
}
