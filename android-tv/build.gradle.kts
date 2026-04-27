// Top-level build file — ne rien mettre ici sauf les plugins partagés.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android)      apply false
    alias(libs.plugins.kotlin.compose)      apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
