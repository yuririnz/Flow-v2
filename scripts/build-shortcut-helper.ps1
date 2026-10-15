Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repositoryRoot = Resolve-Path (Join-Path $scriptDirectory '..') | Select-Object -ExpandProperty Path
$sourceDirectory = Join-Path $repositoryRoot 'native\shortcut-helper'
$outputDirectory = Join-Path $repositoryRoot 'panel\bin'
$outputFile = Join-Path $outputDirectory 'flow-shortcut-helper.exe'

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

Push-Location $sourceDirectory
try {
    go test ./...
    go build -trimpath -ldflags '-s -w' -o $outputFile .
} finally {
    Pop-Location
}

Write-Host "Built $outputFile"
