from rest_framework import serializers


class CompareInputSerializer(serializers.Serializer):
    resume = serializers.CharField(
        min_length=10,
        max_length=100_000,  # ~70 pages; PDFs can be large
        trim_whitespace=True,
    )
    job_description = serializers.CharField(
        min_length=10,
        max_length=50_000,
        trim_whitespace=True,
    )
