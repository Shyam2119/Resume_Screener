from django.conf import settings
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import CompareInputSerializer
from .services.ai_service import (
    AIServiceError,
    analyze_all,
    analyze_skill_gap,
    generate_verdict,
    is_ai_configured,
)
from .services.file_parser import extract_text


class SkillGapView(APIView):
    def post(self, request):
        serializer = CompareInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        resume = serializer.validated_data["resume"]
        job_description = serializer.validated_data["job_description"]

        try:
            result = analyze_skill_gap(resume, job_description)
        except AIServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)

        return Response(result)


class FitVerdictView(APIView):
    def post(self, request):
        serializer = CompareInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        resume = serializer.validated_data["resume"]
        job_description = serializer.validated_data["job_description"]

        try:
            result = generate_verdict(resume, job_description)
        except AIServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)

        return Response(result)


class AnalyzeAllView(APIView):
    """Run both skill-gap and fit-verdict analysis in a single request."""

    def post(self, request):
        serializer = CompareInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        resume = serializer.validated_data["resume"]
        job_description = serializer.validated_data["job_description"]

        try:
            result = analyze_all(resume, job_description)
        except AIServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)

        return Response(result)


class ParseFileView(APIView):
    """Accept a PDF or DOCX file upload and return extracted plain text."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "No file provided. Send a multipart form with field 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_mb = 5
        if uploaded.size > max_mb * 1024 * 1024:
            return Response(
                {"detail": f"File too large. Maximum size is {max_mb} MB."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        try:
            file_bytes = uploaded.read()
            text = extract_text(file_bytes, uploaded.name)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"text": text, "filename": uploaded.name, "chars": len(text)})


class HealthView(APIView):
    def get(self, request):
        return Response({
            "status": "ok",
            "ai_configured": is_ai_configured(),
            "model": settings.GEMINI_MODEL,
        })
